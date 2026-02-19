"""Document and URL loading with metadata extraction."""
import tempfile, os
from urllib.parse import urlparse
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader, UnstructuredFileLoader


def _is_valid_url(url: str) -> bool:
    try:
        r = urlparse(url)
        return all([r.scheme in ("http", "https"), r.netloc])
    except Exception:
        return False


def _extract_title(doc) -> str:
    meta = doc.metadata
    for key in ("title", "Title", "subject", "Subject"):
        if meta.get(key):
            return str(meta[key]).strip()
    source = meta.get("source", "Unknown")
    if source.startswith("http"):
        return urlparse(source).netloc + urlparse(source).path[:60]
    return os.path.basename(source)


def load_from_urls(urls_text: str) -> tuple[list, list[str]]:
    """Load documents from newline-separated URLs. Returns (docs, errors)."""
    docs, errors = [], []
    urls = [u.strip() for u in urls_text.strip().splitlines() if u.strip()]
    for url in urls:
        if not _is_valid_url(url):
            errors.append(f"Invalid URL: {url}")
            continue
        try:
            loader = WebBaseLoader(
                url,
                header_template={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            )
            loaded = loader.load()
            for d in loaded:
                d.metadata["title"] = _extract_title(d)
                d.metadata["source_url"] = url
            docs.extend(loaded)
        except Exception as e:
            errors.append(f"Failed to load {url}: {str(e)[:100]}")
    return docs, errors


def load_from_files(file_paths: list[dict]) -> tuple[list, list[str]]:
    """Load documents from saved temp file paths. Returns (docs, errors).
    Each item: {"path": str, "name": str}
    """
    docs, errors = [], []
    for f in file_paths:
        try:
            path, name = f["path"], f["name"]
            suffix = os.path.splitext(name)[1].lower()
            if suffix == ".pdf":
                loader = PyPDFLoader(path)
            else:
                loader = UnstructuredFileLoader(path)
            loaded = loader.load()
            for d in loaded:
                d.metadata["title"] = name
                d.metadata["source_file"] = name
            docs.extend(loaded)
        except Exception as e:
            errors.append(f"Failed to load {f.get('name','?')}: {str(e)[:100]}")
    return docs, errors
