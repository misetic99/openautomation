using System.Collections.Generic;
using OpenAutomation.Bridge;
using Xunit;

namespace OpenAutomation.Bridge.Tests
{
    public class HardwareJsonTests
    {
        private static HwDevice Plc() => new HwDevice
        {
            Name = "PLC_1",
            TypeIdentifier = "OrderNumber:6ES7 513-1AL02-0AB0/V2.9",
            Software = "PlcSoftware",
            Plc = "PLC_1",
            Items = new List<HwItem>
            {
                new HwItem
                {
                    Name = "DI 16x24VDC_1",
                    TypeIdentifier = "OrderNumber:6ES7 521-1BH00-0AB0/V2.1",
                    Position = 2,
                    Addresses = new List<HwAddress> { new HwAddress { IoType = "Input", Start = 0, Length = 16 } },
                },
                new HwItem
                {
                    Name = "PLC_1",
                    TypeIdentifier = "OrderNumber:6ES7 513-1AL02-0AB0/V2.9",
                    Position = 1,
                    Items = new List<HwItem>
                    {
                        new HwItem { Name = "PROFINET interface_1", TypeIdentifier = "System:Rack.Interface", NetworkAddress = "192.168.0.1" },
                    },
                },
            },
        };

        [Fact]
        public void SortsItemsByPositionAndWritesStableJson()
        {
            string json = HardwareJson.Write(new[] { Plc() });

            // The CPU (position 1) and what sits inside it come before the module (position 2).
            Assert.True(json.IndexOf("PROFINET interface_1") < json.IndexOf("DI 16x24VDC_1"));
            Assert.Contains("\"plc\": \"PLC_1\"", json);
            Assert.Contains("{ \"ioType\": \"Input\", \"start\": 0, \"length\": 16 }", json);
            Assert.Contains("\"networkAddress\": \"192.168.0.1\"", json);
            Assert.EndsWith("\n", json);
            Assert.DoesNotContain("\r", json);
        }

        [Fact]
        public void SameInputGivesSameOutputRegardlessOfInputOrder()
        {
            var a = new HwDevice { Name = "A", TypeIdentifier = "x" };
            var b = new HwDevice { Name = "B", TypeIdentifier = "y" };

            Assert.Equal(HardwareJson.Write(new[] { a, b }), HardwareJson.Write(new[] { b, a }));
        }

        [Fact]
        public void EmptyProjectIsValidJson()
        {
            Assert.Equal("{\n  \"format\": 1,\n  \"devices\": []\n}\n", HardwareJson.Write(new HwDevice[0]));
        }

        [Fact]
        public void OmitsOptionalFieldsThatAreNotSet()
        {
            var device = new HwDevice { Name = "Switch", TypeIdentifier = "t" };
            string json = HardwareJson.Write(new[] { device });

            Assert.DoesNotContain("\"software\"", json);
            Assert.DoesNotContain("\"plc\"", json);
        }
    }

    public class AmlNormalizationTests
    {
        [Fact]
        public void RemovesWriteTimeFromAutomationMl()
        {
            const string aml =
                "<CAEXFile FileName=\"x.aml\"><AdditionalInformation>" +
                "<WriterName>TIA</WriterName>" +
                "<LastWritingDateTime>2026-03-04T10:11:12</LastWritingDateTime>" +
                "</AdditionalInformation></CAEXFile>";

            string result = XmlNormalizer.Normalize(aml);

            Assert.DoesNotContain("LastWritingDateTime", result);
            Assert.Contains("<WriterName>TIA</WriterName>", result);
        }
    }
}
