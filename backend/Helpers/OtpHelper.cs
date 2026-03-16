namespace EXPOAPI.Helpers
{
    public class OtpHelper
    {
        public static string GenerateOtp6Digit()
        {
            var random = new Random();
            return random.Next(100000, 1000000).ToString();
        }
    }
}
