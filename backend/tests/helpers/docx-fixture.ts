import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

interface RunFixture {
  text: string;
  fontFamily?: string;
  fontSizeHalfPoints?: number;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | string;
}

interface ParagraphFixture extends RunFixture {
  styleId?: string;
  alignment?: 'left' | 'center' | 'right';
  runs?: RunFixture[];
  paragraphMarkFontFamily?: string;
  paragraphMarkFontSizeHalfPoints?: number;
  line?: number;
  lineRule?: 'auto' | 'exact' | 'atLeast';
  before?: number;
  after?: number;
  firstLineChars?: number;
  firstLine?: number;
  leftChars?: number;
  left?: number;
  rightChars?: number;
  right?: number;
  hangingChars?: number;
  hanging?: number;
  numbering?: {
    numId: string;
    ilvl: number;
  };
}

interface TableCellFixture {
  paragraphs: ParagraphFixture[];
}

interface TableRowFixture {
  cells: TableCellFixture[];
}

interface TableFixture {
  rows: TableRowFixture[];
}

type DocumentBlockFixture =
  | { type: 'paragraph'; paragraph: ParagraphFixture }
  | { type: 'table'; table: TableFixture };

interface NumberingFixture {
  numId: string;
  abstractNumId: string;
  format: string;
  levelText: string;
}

interface CreateDocxFixtureInput {
  paragraphs?: ParagraphFixture[];
  documentBlocks?: DocumentBlockFixture[];
  numbering?: NumberingFixture[];
  defaultFontSizeHalfPoints?: number;
  headers?: string[];
  headerParagraphs?: ParagraphFixture[];
  footerParagraphs?: ParagraphFixture[];
  includeFooterPageNumber?: boolean;
  footerAlignment?: 'left' | 'center' | 'right';
}

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const buildRunPropertiesXml = (run: Partial<RunFixture>): string => [
  run.fontFamily
    ? `<w:rFonts w:ascii="${run.fontFamily}" w:hAnsi="${run.fontFamily}" w:eastAsia="${run.fontFamily}"/>`
    : '',
  run.fontSizeHalfPoints !== undefined
    ? `<w:sz w:val="${run.fontSizeHalfPoints}"/>`
    : '',
  run.fontColor
    ? `<w:color w:val="${run.fontColor.replace(/^#/, '')}"/>`
    : '',
  run.bold !== undefined
    ? `<w:b${run.bold ? '' : ' w:val="0"'}/>`
    : '',
  run.italic !== undefined
    ? `<w:i${run.italic ? '' : ' w:val="0"'}/>`
    : '',
  run.underline
    ? `<w:u w:val="${typeof run.underline === 'string' ? run.underline : 'single'}"/>`
    : '',
].join('');

const buildParagraphXml = (paragraph: ParagraphFixture): string => {
  const paragraphProperties: string[] = [];

  if (paragraph.styleId) {
    paragraphProperties.push(`<w:pStyle w:val="${paragraph.styleId}"/>`);
  }

  if (paragraph.alignment) {
    paragraphProperties.push(
      `<w:jc w:val="${
        paragraph.alignment === 'center' ? 'center' : paragraph.alignment === 'right' ? 'right' : 'left'
      }"/>`
    );
  }

  if (paragraph.numbering) {
    paragraphProperties.push(
      `<w:numPr><w:ilvl w:val="${paragraph.numbering.ilvl}"/><w:numId w:val="${paragraph.numbering.numId}"/></w:numPr>`
    );
  }

  const paragraphMarkRunProperties = buildRunPropertiesXml({
    fontFamily: paragraph.paragraphMarkFontFamily,
    fontSizeHalfPoints: paragraph.paragraphMarkFontSizeHalfPoints,
  });
  if (paragraphMarkRunProperties) {
    paragraphProperties.push(`<w:rPr>${paragraphMarkRunProperties}</w:rPr>`);
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

  if (
    paragraph.firstLineChars !== undefined
    || paragraph.firstLine !== undefined
    || paragraph.leftChars !== undefined
    || paragraph.left !== undefined
    || paragraph.rightChars !== undefined
    || paragraph.right !== undefined
    || paragraph.hangingChars !== undefined
    || paragraph.hanging !== undefined
  ) {
    paragraphProperties.push(`<w:ind${
      paragraph.firstLineChars !== undefined ? ` w:firstLineChars="${paragraph.firstLineChars}"` : ''
    }${
      paragraph.firstLine !== undefined ? ` w:firstLine="${paragraph.firstLine}"` : ''
    }${
      paragraph.leftChars !== undefined ? ` w:leftChars="${paragraph.leftChars}"` : ''
    }${
      paragraph.left !== undefined ? ` w:left="${paragraph.left}"` : ''
    }${
      paragraph.rightChars !== undefined ? ` w:rightChars="${paragraph.rightChars}"` : ''
    }${
      paragraph.right !== undefined ? ` w:right="${paragraph.right}"` : ''
    }${
      paragraph.hangingChars !== undefined ? ` w:hangingChars="${paragraph.hangingChars}"` : ''
    }${
      paragraph.hanging !== undefined ? ` w:hanging="${paragraph.hanging}"` : ''
    }/>`);
  }

  const runs = paragraph.runs ?? [{
    text: paragraph.text,
    fontFamily: paragraph.fontFamily,
    fontSizeHalfPoints: paragraph.fontSizeHalfPoints,
    fontColor: paragraph.fontColor,
    bold: paragraph.bold,
    italic: paragraph.italic,
    underline: paragraph.underline,
  }];

  return `
    <w:p>
      ${paragraphProperties.length > 0 ? `<w:pPr>${paragraphProperties.join('')}</w:pPr>` : ''}
      ${runs.map((run) => {
        const runProperties = buildRunPropertiesXml(run);
        return `<w:r>
          ${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ''}
          <w:t>${xmlEscape(run.text)}</w:t>
        </w:r>`;
      }).join('')}
    </w:p>
  `;
};

const buildTableXml = (table: TableFixture): string => `
  <w:tbl>
    ${table.rows.map((row) => `
      <w:tr>
        ${row.cells.map((cell) => `
          <w:tc>
            ${cell.paragraphs.map((paragraph) => buildParagraphXml(paragraph)).join('')}
          </w:tc>
        `).join('')}
      </w:tr>
    `).join('')}
  </w:tbl>
`;

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
  const headerCount = (input.headers?.length ?? 0) + (input.headerParagraphs?.length ? 1 : 0);
  const hasFooter = Boolean(input.includeFooterPageNumber || input.footerParagraphs?.length);
  const documentBlocks = input.documentBlocks ?? (input.paragraphs ?? []).map((paragraph) => ({
    type: 'paragraph' as const,
    paragraph,
  }));

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  ${input.numbering?.length ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : ''}
  ${headerCount > 0 ? Array.from({ length: headerCount }, (_, index) => `<Override PartName="/word/header${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`).join('') : ''}
  ${hasFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}
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
        <w:sz w:val="${input.defaultFontSizeHalfPoints ?? 24}"/>
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

  if (hasFooter) {
    zip.folder('word')?.file('footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${(input.footerParagraphs ?? []).map((paragraph) => buildParagraphXml(paragraph)).join('')}
  ${input.includeFooterPageNumber ? `<w:p>
    <w:pPr><w:jc w:val="${input.footerAlignment ?? 'center'}"/></w:pPr>
    <w:r><w:instrText> PAGE </w:instrText></w:r>
  </w:p>
  ` : ''}
</w:ftr>`);
  }

  input.headers?.forEach((headerText, index) => {
    zip.folder('word')?.file(`header${index + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:r><w:t>${xmlEscape(headerText)}</w:t></w:r>
  </w:p>
</w:hdr>`);
  });

  if (input.headerParagraphs?.length) {
    zip.folder('word')?.file(`header${(input.headers?.length ?? 0) + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${input.headerParagraphs.map((paragraph) => buildParagraphXml(paragraph)).join('')}
</w:hdr>`);
  }

  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${documentBlocks.map((block) => (
      block.type === 'paragraph'
        ? buildParagraphXml(block.paragraph)
        : buildTableXml(block.table)
    )).join('')}
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
