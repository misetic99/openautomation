using OpenAutomation.Bridge;
using Xunit;

namespace OpenAutomation.Bridge.Tests
{
    public class ExportLayoutTests
    {
        [Theory]
        [InlineData("FB_Motor", "FB_Motor")]
        [InlineData("a/b:c", "a_b_c")]
        [InlineData("name. ", "name")]
        [InlineData("CON", "_CON")]
        [InlineData("", "_")]
        public void SafeName(string input, string expected)
        {
            Assert.Equal(expected, ExportLayout.SafeName(input));
        }

        [Fact]
        public void RelativePathUsesForwardSlashesAndGroups()
        {
            Assert.Equal(
                "blocks/Motors/Pumps/FB_Pump.scl",
                ExportLayout.RelativePath("blocks", new[] { "Motors", "Pumps" }, "FB_Pump", ".scl"));
        }

        [Fact]
        public void RelativePathWithoutGroups()
        {
            Assert.Equal("tags/Inputs.xml", ExportLayout.RelativePath("tags", new string[0], "Inputs", ".xml"));
        }

        [Fact]
        public void ProjectJsonIsSortedAndHasNoVolatileData()
        {
            string json = ExportLayout.ProjectJson("V18", new[] { "PLC_2", "PLC_1" });

            Assert.Equal(
                "{\n  \"format\": 1,\n  \"tiaVersion\": \"V18\",\n  \"plcs\": [\n    \"PLC_1\",\n    \"PLC_2\"\n  ]\n}\n",
                json);
        }

        [Fact]
        public void JsonStringEscapes()
        {
            Assert.Equal("\"a\\\"b\\\\c\\n\"", ExportLayout.JsonString("a\"b\\c\n"));
        }
    }
}
