namespace EXPOAPI.Helpers
{

    public static class EmailTemplateRenderer
    {
        public static string RenderVendorOtpBody(string email, string otp)
        {
            email ??= "";
            otp ??= "";

            return
                "<link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css\" " +
                "rel=\"stylesheet\" " +
                "integrity=\"sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH\" " +
                "crossorigin=\"anonymous\">" +
                "<div class=\"card\" style=\"margin-left:auto; margin-right:auto;\">" +
                "  <div class=\"card-body px-2 py-0\" style=\"border-radius: 1.7rem; background-color:white;\">" +
                "    <div style=\"text-align:center;\">" +
                $"      <h4>Hello, {System.Net.WebUtility.HtmlEncode(email)}</h4>" +
                "      <h4>Your One-Time Password (OTP)</h4>" +
                "      <hr />" +
                "      <p style=\"color:#666666\">Use the OTP code below to complete your login process. " +
                "This code is valid for the next 15 Minutes.</p>" +
                $"      <h1 style=\"color:#00A0FF\">{System.Net.WebUtility.HtmlEncode(otp)}</h1>" +
                "      <p style=\"color:#AAAAAA;\">If you did not request this code, please ignore this email.</p>" +
                "    </div>" +
                "  </div>" +
                "</div>";
        }
    }
}
