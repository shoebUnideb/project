from rest_framework import serializers

_MAGIC = [
    (b'\xff\xd8\xff',       'image/jpeg'),
    (b'\x89PNG\r\n\x1a\n', 'image/png'),
    (b'GIF87a',             'image/gif'),
    (b'GIF89a',             'image/gif'),
    (b'%PDF',               'application/pdf'),
    (b'PK\x03\x04',        'application/zip'),  # DOCX, XLSX, PPTX
]

_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
_DOC_TYPES   = {'application/pdf', 'application/zip'}


def _detect_mime(file) -> str:
    file.seek(0)
    header = file.read(12)
    file.seek(0)
    if len(header) >= 12 and header[:4] == b'RIFF' and header[8:12] == b'WEBP':
        return 'image/webp'
    if len(header) >= 8 and header[4:8] == b'ftyp':
        return 'video/mp4'
    for sig, mime in _MAGIC:
        if header[:len(sig)] == sig:
            return mime
    return 'application/octet-stream'


def validate_image(file):
    if file.size > 5 * 1024 * 1024:
        raise serializers.ValidationError('Image must be under 5 MB.')
    mime = _detect_mime(file)
    if mime not in _IMAGE_TYPES:
        raise serializers.ValidationError(
            f'Unsupported image type. Allowed: JPEG, PNG, GIF, WebP.'
        )
    return file


def validate_document(file):
    if file.size > 20 * 1024 * 1024:
        raise serializers.ValidationError('File must be under 20 MB.')
    mime = _detect_mime(file)
    if mime not in _DOC_TYPES:
        raise serializers.ValidationError(
            'Unsupported file type. Allowed: PDF, DOCX, XLSX, PPTX.'
        )
    return file


def validate_attachment(file):
    if file.size > 20 * 1024 * 1024:
        raise serializers.ValidationError('Attachment must be under 20 MB.')
    mime = _detect_mime(file)
    if mime not in (_IMAGE_TYPES | _DOC_TYPES):
        raise serializers.ValidationError(
            'Unsupported attachment type. Allowed: JPEG, PNG, GIF, WebP, PDF, DOCX, XLSX, PPTX.'
        )
    return file
