using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace OpenAutomation.Bridge
{
    /// <summary>
    /// Makes exported SimaticML stable so that two exports of an unchanged project are
    /// byte-identical: removes volatile elements and fixes encoding, indentation and
    /// line endings.
    ///
    /// The element list below comes from the documented SimaticML attribute set and has
    /// to be confirmed against real exports from each supported TIA Portal version
    /// (see corpus/). Add a name here when a new volatile element turns up.
    /// </summary>
    public static class XmlNormalizer
    {
        public static readonly IReadOnlyCollection<string> VolatileElements = new[]
        {
            "ModifiedDate",
            "StructureModifiedDate",
            "InterfaceModifiedDate",
            "ParameterModifiedDate",
            "CompileDate",
        };

        public static string Normalize(string xml)
        {
            XDocument doc = XDocument.Parse(xml.TrimStart('﻿'), LoadOptions.None);

            doc.Descendants()
               .Where(e => VolatileElements.Contains(e.Name.LocalName))
               .ToList()
               .ForEach(e => e.Remove());

            var settings = new XmlWriterSettings
            {
                Encoding = new UTF8Encoding(false),
                Indent = true,
                IndentChars = "  ",
                NewLineChars = "\n",
                NewLineHandling = NewLineHandling.Replace,
                OmitXmlDeclaration = false,
            };

            // StringWriter would force UTF-16 in the declaration, so write through a stream.
            using (var stream = new MemoryStream())
            {
                using (XmlWriter writer = XmlWriter.Create(stream, settings))
                    doc.Save(writer);
                string text = settings.Encoding.GetString(stream.ToArray());
                return text.Length > 0 && text[0] == '﻿' ? text.Substring(1) : text;
            }
        }

        /// <summary>Writes the normalized form of <paramref name="source"/> to <paramref name="target"/>.</summary>
        public static void NormalizeFile(string source, string target)
        {
            string normalized = Normalize(File.ReadAllText(source, Encoding.UTF8));
            Directory.CreateDirectory(Path.GetDirectoryName(target) ?? ".");
            File.WriteAllText(target, normalized, new UTF8Encoding(false));
        }
    }
}
