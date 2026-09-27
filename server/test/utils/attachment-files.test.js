const { expect } = require('chai');
const {
  DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS,
  parseAllowedExtensions,
  getFileExtension,
  isAllowedExtension,
  isDetectedTypeAllowed,
  findSvgActiveContent,
} = require('../../utils/attachment-files');

describe('attachment-files', () => {
  describe('#parseAllowedExtensions(value)', () => {
    it('should fall back to the default list when unset or empty', () => {
      expect(parseAllowedExtensions(undefined)).to.deep.equal(
        DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS,
      );
      expect(parseAllowedExtensions('')).to.deep.equal(DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS);
      expect(parseAllowedExtensions(' , ')).to.deep.equal(DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS);
    });

    it('should return null (any type allowed) for "*"', () => {
      expect(parseAllowedExtensions('*')).to.equal(null);
      expect(parseAllowedExtensions(' * ')).to.equal(null);
    });

    it('should normalize case, whitespace, leading dots and duplicates', () => {
      expect(parseAllowedExtensions(' PDF, .Docx ,png,pdf ')).to.deep.equal(['pdf', 'docx', 'png']);
    });
  });

  describe('#getFileExtension(filename)', () => {
    it('should return the lowercased last extension', () => {
      expect(getFileExtension('Report.PDF')).to.equal('pdf');
      expect(getFileExtension('archive.tar.gz')).to.equal('gz');
    });

    it('should return null when there is no extension', () => {
      expect(getFileExtension('README')).to.equal(null);
      expect(getFileExtension('.bashrc')).to.equal(null);
      expect(getFileExtension('photo.')).to.equal(null);
      expect(getFileExtension('')).to.equal(null);
    });
  });

  describe('#isAllowedExtension(filename, allowedExtensions)', () => {
    it('should accept files whose extension is in the list', () => {
      expect(isAllowedExtension('slides.PPTX', DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS)).to.equal(
        true,
      );
      expect(isAllowedExtension('clip.mp4', DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS)).to.equal(true);
    });

    it('should reject files whose extension is not in the list', () => {
      expect(isAllowedExtension('setup.exe', DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS)).to.equal(
        false,
      );
      expect(isAllowedExtension('script.sh', DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS)).to.equal(
        false,
      );
      expect(isAllowedExtension('Makefile', DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS)).to.equal(false);
    });

    it('should accept anything when the list is null', () => {
      expect(isAllowedExtension('setup.exe', null)).to.equal(true);
      expect(isAllowedExtension('Makefile', null)).to.equal(true);
    });
  });

  describe('#isDetectedTypeAllowed(extension, fileType, allowedExtensions)', () => {
    const allowed = DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS;

    it('should accept content that was not recognized as a binary type', () => {
      expect(isDetectedTypeAllowed('csv', undefined, allowed)).to.equal(true);
      expect(isDetectedTypeAllowed('txt', null, allowed)).to.equal(true);
    });

    it('should accept content matching an allowed type', () => {
      expect(
        isDetectedTypeAllowed('pdf', { ext: 'pdf', mime: 'application/pdf' }, allowed),
      ).to.equal(true);
      expect(isDetectedTypeAllowed('jpeg', { ext: 'jpg', mime: 'image/jpeg' }, allowed)).to.equal(
        true,
      );
    });

    it('should accept container formats used by allowed document types', () => {
      expect(
        isDetectedTypeAllowed('doc', { ext: 'cfb', mime: 'application/x-cfb' }, allowed),
      ).to.equal(true);
      expect(
        isDetectedTypeAllowed('xlsx', { ext: 'zip', mime: 'application/zip' }, allowed),
      ).to.equal(true);
      expect(
        isDetectedTypeAllowed('svg', { ext: 'xml', mime: 'application/xml' }, allowed),
      ).to.equal(true);
    });

    it('should accept media whose detected type is in the same family as the extension', () => {
      expect(isDetectedTypeAllowed('mp4', { ext: '3gp', mime: 'video/3gpp' }, allowed)).to.equal(
        true,
      );
      expect(isDetectedTypeAllowed('ogg', { ext: 'oga', mime: 'audio/ogg' }, ['ogg'])).to.equal(
        true,
      );
    });

    it('should reject content whose real type is not allowed', () => {
      expect(
        isDetectedTypeAllowed('pdf', { ext: 'exe', mime: 'application/x-msdownload' }, allowed),
      ).to.equal(false);
      expect(
        isDetectedTypeAllowed('docx', { ext: 'jar', mime: 'application/java-archive' }, allowed),
      ).to.equal(false);
      expect(
        isDetectedTypeAllowed('txt', { ext: 'elf', mime: 'application/x-elf' }, allowed),
      ).to.equal(false);
    });

    it('should reject container formats used under an unrelated extension', () => {
      expect(
        isDetectedTypeAllowed('pdf', { ext: 'cfb', mime: 'application/x-cfb' }, allowed),
      ).to.equal(false);
      expect(
        isDetectedTypeAllowed('png', { ext: 'xml', mime: 'application/xml' }, allowed),
      ).to.equal(false);
    });

    it('should accept anything when the list is null', () => {
      expect(
        isDetectedTypeAllowed('exe', { ext: 'exe', mime: 'application/x-msdownload' }, null),
      ).to.equal(true);
    });
  });

  describe('#findSvgActiveContent(text)', () => {
    const wrap = (inner) =>
      `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${inner}</svg>`;

    it('should accept a plain drawing', () => {
      expect(
        findSvgActiveContent(
          wrap(
            '<defs><linearGradient id="g"/></defs><rect width="10" height="10" fill="url(#g)"/>' +
              '<use href="#g"/><use xlink:href="#g"/><image href="data:image/png;base64,iVBORw0KGgo="/>' +
              '<style>.a{fill:red}</style><text>Turn on the lights</text>',
          ),
        ),
      ).to.equal(null);
    });

    it('should reject script elements, including namespaced and uppercase ones', () => {
      expect(findSvgActiveContent(wrap('<script>alert(1)</script>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<svg:script>alert(1)</svg:script>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<SCRIPT>alert(1)</SCRIPT>'))).to.be.a('string');
    });

    it('should reject event handler attributes', () => {
      expect(findSvgActiveContent(wrap('<rect onload="alert(1)"/>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<rect\nONCLICK = "alert(1)"/>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<rect/onmouseover="alert(1)"/>'))).to.be.a('string');
    });

    it('should reject script URLs, including entity-encoded and whitespace-split ones', () => {
      expect(
        findSvgActiveContent(wrap('<a href="javascript:alert(1)"><text>x</text></a>')),
      ).to.be.a('string');
      expect(findSvgActiveContent(wrap('<a href="&#106;avascript:alert(1)">x</a>'))).to.be.a(
        'string',
      );
      expect(findSvgActiveContent(wrap('<a href="jav&#x09;ascript:alert(1)">x</a>'))).to.be.a(
        'string',
      );
      expect(
        findSvgActiveContent(wrap('<a xlink:href="java\nscript&colon;alert(1)">x</a>')),
      ).to.be.a('string');
    });

    it('should reject embedded documents and entity declarations', () => {
      expect(findSvgActiveContent(wrap('<foreignObject><div/></foreignObject>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<iframe src="x"/>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<embed src="x"/>'))).to.be.a('string');
      expect(findSvgActiveContent(wrap('<object data="x"/>'))).to.be.a('string');
      expect(
        findSvgActiveContent(`<!DOCTYPE svg [<!ENTITY x "y">]>${wrap('<text>&x;</text>')}`),
      ).to.be.a('string');
      expect(
        findSvgActiveContent(`<?xml-stylesheet type="text/xsl" href="t.xsl"?>${wrap('')}`),
      ).to.be.a('string');
    });

    it('should reject unsafe data URLs', () => {
      expect(
        findSvgActiveContent(wrap('<image href="data:image/svg+xml;base64,PHN2Zz4="/>')),
      ).to.be.a('string');
      expect(findSvgActiveContent(wrap('<a href="data:text/html,<b>x</b>">x</a>'))).to.be.a(
        'string',
      );
    });

    it('should reject references to outside resources', () => {
      expect(findSvgActiveContent(wrap('<image href="https://example.com/x.png"/>'))).to.be.a(
        'string',
      );
      expect(findSvgActiveContent(wrap('<image xlink:href="//example.com/x.png"/>'))).to.be.a(
        'string',
      );
      expect(findSvgActiveContent(wrap('<style>@import "x.css";</style>'))).to.be.a('string');
      expect(
        findSvgActiveContent(wrap('<rect style="fill: url( \'http://example.com/p\' )"/>')),
      ).to.be.a('string');
    });
  });
});
