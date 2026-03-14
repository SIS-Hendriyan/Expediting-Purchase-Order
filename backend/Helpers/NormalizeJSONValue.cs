using System.Text.Json;

namespace EXPOAPI.Helpers
{
    public class NormalizeJSONValue
    {
        public static object? NormalizeJsonValue(object? value)
        {
            if (value is null) return null;

            if (value is JsonElement je)
            {
                switch (je.ValueKind)
                {
                    case JsonValueKind.String:
                        return je.GetString();

                    case JsonValueKind.Number:  
                        if (je.TryGetInt32(out var i)) return i;
                        if (je.TryGetInt64(out var l)) return l;
                        if (je.TryGetDecimal(out var d)) return d;
                        if (je.TryGetDouble(out var db)) return db;
                        return je.ToString();

                    case JsonValueKind.True:
                    case JsonValueKind.False:
                        return je.GetBoolean();

                    case JsonValueKind.Null:
                    case JsonValueKind.Undefined:
                        return null;

                    default:
                        return je.ToString();
                }
            }

            return value;
        }
    }


}
