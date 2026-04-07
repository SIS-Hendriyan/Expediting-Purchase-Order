namespace EXPOAPI.Models
{
    //public class PurchaseOrderImportRequest
    //{
    //    public IFormFile? File { get; set; }
    //}

    public class PurchaseOrderImportRequest
    {
        public IFormFile? ME2NFile { get; set; }
        public IFormFile? ME5AFile { get; set; }
        public IFormFile? ZMM013RFile { get; set; }
    }

}
