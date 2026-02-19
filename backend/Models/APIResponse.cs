namespace EXPOAPI.Models
{
    public static class ApiResponse
    {
        public static object Ok(string message, object? Data, int ResponseCode = 200)
            => new
            {
                success = true,
                ResponseCode,
                message,
                Data
            };

        public static object Fail(string message, int ResponseCode = 400, object? Data = null)
            => new
            {
                success = false,
                ResponseCode,
                message,
                Data
            };
    }

}
