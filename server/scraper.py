import feedparser
import requests
from bs4 import BeautifulSoup
import urllib.parse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import lxml


def get_google_news_articles_rss(keyword: str, limit: int = 25):
    q = urllib.parse.quote(keyword)
    lang = "en"
    region = "US"

    url = f"https://news.google.com/rss/search?q={q}&hl={lang}&gl={region}&ceid={region}:{lang}"

    return feedparser.parse(url).entries[:limit]


def get_google_rss_redirect_links(google_rss_links: list[str]):
    max_workers = min(8, len(google_rss_links))
    timeout = (5, 15)  # (connect seconds, read seconds)

    google_xssi_prefix = ")]}'"

    session = requests.Session()
    session.headers.update(
        {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/132.0.0.0 Safari/537.36",
        }
    )
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(
        max_retries=retry, pool_connections=max_workers, pool_maxsize=max_workers
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    def get_single_redirect_link(google_rss_link: str):
        try:
            r = session.get(google_rss_link, timeout=timeout)
            r.raise_for_status()

            soup = BeautifulSoup(r.text, "lxml")  # lxml is fatser than html.parser
            cwiz = soup.select_one("c-wiz[data-p]")

            if not cwiz:
                return None

            data_p = cwiz.get("data-p")
            if not data_p:
                return None

            obj = json.loads(data_p.replace("%.@.", '["garturlreq",'))

            payload = {
                "f.req": json.dumps(
                    [[["Fbv4je", json.dumps(obj[:-6] + obj[-2:]), "null", "generic"]]]
                )
            }

            r2 = session.post(
                "https://news.google.com/_/DotsSplashUi/data/batchexecute",
                headers={
                    "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
                },
                data=payload,
                timeout=timeout,
            )
            r2.raise_for_status()

            text = r2.text
            if text.startswith(google_xssi_prefix):
                text = text[len(google_xssi_prefix) :]

            outer = json.loads(text)
            array_string = outer[0][2]

            inner = json.loads(array_string)
            article_link = inner[1]

            return article_link
        except Exception:
            print("Error fetching link:", google_rss_link)
            return None

    # Run concurrently
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(get_single_redirect_link, link): link for link in google_rss_links
        }
        for fut in as_completed(futures):
            url = fut.result()
            if url:
                results.append(url)

    # Deduplicate but preserve order
    seen = set()
    deduped = []
    for u in results:
        if u not in seen:
            seen.add(u)
            deduped.append(u)

    return deduped


def scrape_articles(urls: list[str], timeout: int = 20):
    max_workers = min(8, len(urls))

    def get_title(soup):
        for sel in (
            "h1.entry-title",
            "h1.post-title",
            "h1.article-title",
            "article h1",
            "h1",
        ):
            element = soup.select_one(sel)
            if element:
                title = element.get_text(strip=True)
                if title:
                    return title

        meta = soup.select_one('meta[property="og:title"]')

        if meta and meta.get("content"):
            return meta["content"].strip()

        return soup.title.get_text(strip=True) if soup.title else ""

    def get_text(soup):
        for t in soup.select(
            "script,style,noscript,figure,figcaption,aside,header,footer,nav"
        ):
            t.decompose()

        candidates = []
        for sel in (
            "article .entry-content",
            "article",
            "div.entry-content",
            'div[itemprop="articleBody"]',
            "section.article-body",
            "div.post-content",
            "#content",
            "main",
        ):
            c = soup.select_one(sel)
            if c:
                candidates.append(c)

        node = (
            max(candidates, key=lambda n: len(n.find_all("p"))) if candidates else soup
        )
        paragraphs = [p.get_text(" ", strip=True) for p in node.find_all("p")]

        return "\n\n".join(paragraphs).strip()

    headers = {"User-Agent": "Mozilla/5.0 Chrome/124 Safari/537.36"}

    def fetch_one(url: str):
        try:
            with requests.Session() as session:
                session.headers.update(headers)
                response = session.get(url, timeout=timeout)

                response.raise_for_status()
                soup = BeautifulSoup(response.text, "lxml")

                return {"url": url, "title": get_title(soup), "text": get_text(soup)}
        except Exception as e:
            return {"url": url, "title": "", "text": "", "error": str(e)}

    results = []
    order = {u: i for i, u in enumerate(urls)}

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        future_map = {ex.submit(fetch_one, u): u for u in urls}

        for future in as_completed(future_map):
            results.append(future.result())

    # Preserve original URL order
    results.sort(key=lambda r: order.get(r["url"], 10**9))
    return results


if __name__ == "__main__":
    keyword = "Rep. Nikema Williams"

    google_news_articles_rss = get_google_news_articles_rss(keyword, limit=10)
    google_news_articles_rss_links = [
        article.link for article in google_news_articles_rss
    ]

    article_links = get_google_rss_redirect_links(google_news_articles_rss_links)
    print("Article Links:")
    print(article_links)
    print("\n")

    article_data = scrape_articles(article_links)
    for item in article_data:
        print(item["title"], "\n")
        print(item["text"], "\n" + "-" * 80 + "\n")
