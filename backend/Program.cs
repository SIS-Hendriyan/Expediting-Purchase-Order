using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// =========================
// CORS
// =========================
const string CorsPolicyName = "ExpoCors";
builder.Services.AddCors(opt =>
{
    opt.AddPolicy(CorsPolicyName, policy =>
    {
        policy
            .WithOrigins(
                "https://expeditingpo.azurewebsites.net",
                "http://localhost:3000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // kalau kamu pakai cookie/credential. Kalau tidak, boleh dihapus.
    });
});

// =========================
// Controllers + Swagger
// =========================
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = null; // => pakai nama property C# apa adanya (PascalCase)
    o.JsonSerializerOptions.DictionaryKeyPolicy = null;
}); ;

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo { Title = "Expo API", Version = "v1" });

    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Input: Bearer {your JWT token}"
    });

    opt.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// =========================
// Options (Auth Hash)
// =========================
builder.Services.Configure<AuthHashOptions>(builder.Configuration.GetSection("AuthHash"));

// =========================
// DB Factory (DBMain/DBVendor from appsettings.json)
// =========================
builder.Services.AddScoped<IDbConnectionFactory, DbConnectionFactory>();

// =========================
// Email via DB setting SP + SMTP
// =========================
builder.Services.AddScoped<IEmailSettingProvider, DbEmailSettingProvider>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IVendorOtpEmailSender, VendorOtpEmailSender>();
builder.Services.AddScoped<IInternalUserService, InternalUserService>();
builder.Services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
builder.Services.AddScoped<IVendorService, VendorService>();
builder.Services.AddScoped<ISsoAuthService, SsoAuthService>();
builder.Services.Configure<SsoSettings>(builder.Configuration.GetSection("SSO"));
builder.Services.AddScoped<IPurchaseOrderImportService, PurchaseOrderImportService>();

// =========================
// Auth Service
// =========================
builder.Services.AddScoped<AuthService>();

// =========================
// JWT Authentication (Jwt section in appsettings.json)
// =========================
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key missing in appsettings.json");
var jwtIssuer = jwtSection["Issuer"] ?? "expoapi";
var jwtAudience = jwtSection["Audience"] ?? "expoapi-client";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.RequireHttpsMetadata = true;
        opt.SaveToken = true;

        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

var app = builder.Build();

// =========================
// Pipeline
// =========================
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// ✅ CORS harus sebelum Authentication/Authorization
app.UseCors(CorsPolicyName);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
