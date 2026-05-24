import { Injectable } from '@nestjs/common';

export interface DocumentOriginalKeyInput {
  documentId: string;
  documentVersionId: string;
  extension?: string;
}

@Injectable()
export class ObjectKeyService {
  documentOriginal(input: DocumentOriginalKeyInput) {
    const extension = input.extension?.replace(/^\./, '') || 'pdf';
    return `documents/${input.documentId}/versions/${input.documentVersionId}/original.${extension}`;
  }

  ocrText(ocrArtifactId: string) {
    return `ocr/${ocrArtifactId}/text/ocr.txt`;
  }

  reportExport(exportArtifactId: string, extension: string) {
    return `exports/${exportArtifactId}/report.${extension.replace(/^\./, '')}`;
  }

  complianceInputImage(checkId: string, mimeType: string): string {
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
    };
    const ext = extMap[mimeType.toLowerCase()] ?? 'jpg';
    return `compliance-inputs/${checkId}/input.${ext}`;
  }
}