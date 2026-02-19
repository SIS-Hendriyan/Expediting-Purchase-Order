namespace EXPOAPI.Models
{
    public  class EmailSetting
    {
        public string FromEmail { get; set; } = "";
        public string MailboxName { get; set; } = "";
        public string SmtpHost { get; set; } = "";
        public int SmtpPort { get; set; }
        public string Password { get; set; } = "";
        public bool UseSsl { get; set; }
        public List<string> Bcc { get; set; } = new();
    }
}
