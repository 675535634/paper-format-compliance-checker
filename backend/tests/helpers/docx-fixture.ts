import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

interface ParagraphFixture {
  text: string;
  styleId?: string;
  fontFamily?: string;
  fontSizeHalfPoints?: number;
  line?: number;
  lineRule?: 'auto' | 'exact' | 'atLeast';
  before?: number;
  after?: number;
  firstLineChars?: number;
  numbering?: {
    numId: string;
    ilvl: number;
  };
}

interface NumberingFixture {
  numId: string;
  abstractNumId: string;
  format: string;
  levelText: string;
}

interface CreateDocxFixtureInput {
  paragraphs: ParagraphFixture[];
  numbering?: NumberingFixture[];
  includeFooterPageNumber?: boolean;
  footerAlignment?: 'left' | 'center' | 'right';
}

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const buildParagraphXml = (paragraph: ParagraphFixture): string => {
  const paragraphProperties: string[] = [];

  if (paragraph.styleId) {
    paragraphProperties.push(`<w:pStyle w:val="${paragraph.styleId}"/>`);
  }

  if (paragraph.numbering) {
    paragraphProperties.push(
      `<w:numPr><w:ilvl w:val="${paragraph.numbering.ilvl}"/><w:numId w:val="${paragraph.numbering.numId}"/></w:numPr>`
    );
  }

  if (
    paragraph.line !== undefined
    || paragraph.before !== undefined
    || paragraph.after !== undefined
  ) {
    paragraphProperties.push(
      `<w:spacing${
        paragraph.line !== undefined ? ` w:line="${paragraph.line}"` : ''
      }${
        paragraph.lineRule ? ` w:lineRule="${paragraph.lineRule}"` : ''
      }${
        paragraph.before !== undefined ? ` w:before="${paragraph.before}"` : ''
      }${
        paragraph.after !== undefined ? ` w:after="${paragraph.after}"` : ''
      }/>`
    );
  }

  if (paragraph.firstLineChars !== undefined) {
    paragraphProperties.push(`<w:ind w:firstLineChars="${paragraph.firstLineChars}"/>`);
  }

  const runProperties = [
    paragraph.fontFamily
      ? `<w:rFonts w:ascii="${paragraph.fontFamily}" w:hAnsi="${paragraph.fontFamily}" w:eastAsia="${paragraph.fontFamily}"/>`
      : '',
    paragraph.fontSizeHalfPoints !== undefined
      ? `<w:sz w:val="${paragraph.fontSizeHalfPoints}"/>`
      : '',
  ].join('');

  return `
    <w:p>
      ${paragraphProperties.length > 0 ? `<w:pPr>${paragraphProperties.join('')}</w:pPr>` : ''}
      <w:r>
        ${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ''}
        <w:t>${xmlEscape(paragraph.text)}</w:t>
      </w:r>
    </w:p>
  `;
};

const buildNumberingXml = (numbering: NumberingFixture[]): string => `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${numbering.map((item) => `
    <w:abstractNum w:abstractNumId="${item.abstractNumId}">
      <w:lvl w:ilvl="0">
        <w:start w:val="1"/>
        <w:numFmt w:val="${item.format}"/>
        <w:lvlText w:val="${item.levelText}"/>
      </w:lvl>
    </w:abstractNum>
    <w:num w:numId="${item.numId}">
      <w:abstractNumId w:val="${item.abstractNumId}"/>
    </w:num>
  `).join('')}
</w:numbering>
`;

export const createDocxFixture = async (input: CreateDocxFixtureInput): Promise<{
  filePath: string;
  cleanup: () => Promise<void>;
}> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-docx-'));
  const filePath = path.join(tempDir, 'fixture.docx');
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  ${input.numbering?.length ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : ''}
  ${input.includeFooterPageNumber ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}
</Types>`);

  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.folder('word')?.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:rPr>
      <w:rFonts w:eastAsia="黑体"/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
</w:styles>`);

  if (input.numbering?.length) {
    zip.folder('word')?.file('numbering.xml', buildNumberingXml(input.numbering));
  }

  if (input.includeFooterPageNumber) {
    zip.folder('word')?.file('footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="${input.footerAlignment ?? 'center'}"/></w:pPr>
    <w:r><w:instrText> PAGE </w:instrText></w:r>
  </w:p>
</w:ftr>`);
  }

  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${input.paragraphs.map((paragraph) => buildParagraphXml(paragraph)).join('')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1701"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(filePath, content);

  return {
    filePath,
    cleanup: async () => rm(tempDir, { recursive: true, force: true }),
  };
};
