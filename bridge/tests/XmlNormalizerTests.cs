using OpenAutomation.Bridge;
using Xunit;

namespace OpenAutomation.Bridge.Tests
{
    public class XmlNormalizerTests
    {
        private const string Sample =
            "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n" +
            "<Document>\r\n" +
            "<Engineering version=\"V18\" />\r\n" +
            "<SW.Blocks.FC ID=\"0\"><AttributeList>\r\n" +
            "      <Name>FC_Test</Name>\r\n" +
            "      <ModifiedDate>2026-01-01T10:00:00.1234567Z</ModifiedDate>\r\n" +
            "      <StructureModifiedDate>2026-01-01T10:00:00Z</StructureModifiedDate>\r\n" +
            "      <Number>1</Number>\r\n" +
            "</AttributeList></SW.Blocks.FC>\r\n" +
            "</Document>";

        [Fact]
        public void RemovesVolatileElements()
        {
            string result = XmlNormalizer.Normalize(Sample);

            Assert.DoesNotContain("ModifiedDate", result);
            Assert.Contains("<Name>FC_Test</Name>", result);
            Assert.Contains("<Number>1</Number>", result);
        }

        [Fact]
        public void IsIdempotent()
        {
            string once = XmlNormalizer.Normalize(Sample);
            Assert.Equal(once, XmlNormalizer.Normalize(once));
        }

        [Fact]
        public void IgnoresVolatileValuesAndWhitespace()
        {
            string other = Sample
                .Replace("2026-01-01T10:00:00.1234567Z", "2027-05-05T01:02:03.9999999Z")
                .Replace("\r\n", "\n");

            Assert.Equal(XmlNormalizer.Normalize(Sample), XmlNormalizer.Normalize(other));
        }

        [Fact]
        public void UsesLfEndingsAndNoBom()
        {
            string result = XmlNormalizer.Normalize(Sample);

            Assert.DoesNotContain("\r", result);
            Assert.NotEqual('﻿', result[0]);
            Assert.StartsWith("<?xml version=\"1.0\" encoding=\"utf-8\"?>", result);
        }

        [Fact]
        public void KeepsElementOrder()
        {
            string result = XmlNormalizer.Normalize(Sample);
            Assert.True(result.IndexOf("<Name>") < result.IndexOf("<Number>"));
        }
    }
}
