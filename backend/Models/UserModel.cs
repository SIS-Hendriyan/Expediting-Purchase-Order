namespace EXPOAPI.Models
{


    public  class ExpoUserLoginResult
    {
        public InternalAccount account { get; }

        public ExpoUserLoginResult(InternalAccount account)
        {
            this.account = account;
        }

        public Dictionary<string, object> ToDict()
        {
            // Struktur mirip Python: ExpoUserLoginResult(account=...).to_dict()
            return new Dictionary<string, object>
            {
                ["account"] = new Dictionary<string, object?>
                {
                    ["id"] = account.id,
                    ["email"] = account.email,
                    ["name"] = account.name,
                    ["nrp"] = account.nrp,
                    ["role"] = account.role,
                    ["department"] = account.department,
                    ["jobsite"] = account.jobsite
                }
            };
        }
    }
    public class InternalUserRow
    {
        public string? Id { get; set; }
        public string? NRP { get; set; }
        public string? Email { get; set; }
        public string? Nama { get; set; }
        public string? Role { get; set; }
        public string? Department { get; set; }
        public string? Jobsite { get; set; }
        public string? PasswordHash { get; set; }
        public bool IsActive { get; set; }
    }


    public  class InternalAccount
    {
        public string id { get; }
        public string email { get; }
        public string name { get; }

        public string? nrp { get; }
        public string? role { get; }
        public string? department { get; }
        public string? jobsite { get; }

        public InternalAccount(
            string id,
            string email,
            string name,
            string? nrp,
            string? role,
            string? department,
            string? jobsite
        )
        {
            this.id = id ?? "";
            this.email = email ?? "";
            this.name = name ?? "";
            this.nrp = nrp;
            this.role = role;
            this.department = department;
            this.jobsite = jobsite;
        }
    }


    public class InternalUserSummary
    {
        public int TotalUsers { get; set; }
        public int TotalAdmin { get; set; }
        public int TotalPurchaser { get; set; }
        public int TotalUser { get; set; }
    }
}
