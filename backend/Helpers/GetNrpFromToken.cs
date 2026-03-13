using System.Security.Claims;

public static class ClaimsPrincipalExtensions
{
    public static string GetNrp(this ClaimsPrincipal? user)
    {
        if (user is null) return "";

        // 1) claim "nrp" (yang kamu set di JWT)
        var nrp = user.FindFirst("nrp")?.Value;

        // 2) fallback: NameIdentifier / sub
        if (string.IsNullOrWhiteSpace(nrp))
            nrp = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? user.FindFirst("sub")?.Value;

        // 3) fallback: Identity.Name
        if (string.IsNullOrWhiteSpace(nrp))
            nrp = user.Identity?.Name;

        return (nrp ?? "").Trim();
    }
}