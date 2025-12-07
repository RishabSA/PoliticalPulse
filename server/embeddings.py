from openai import OpenAI
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from dotenv import load_dotenv
import matplotlib.pyplot as plt
import os
from scraper import (
    get_google_news_articles_rss,
    get_google_rss_redirect_links,
    scrape_articles,
)

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)


def openai_embed(
    texts: list[str], model: str = "text-embedding-3-large", batch_size: int = 32
):
    # Batched embeddings
    vectors = []

    for i in range(0, len(texts), batch_size):
        batched_texts = texts[i : i + batch_size]

        # Send API Request to OpenAI for text embeddings
        response = client.embeddings.create(model=model, input=batched_texts)

        vectors.extend([d.embedding for d in response.data])

    return np.asarray(vectors, dtype=np.float32)  # shape: (N, D)


def clean_texts(items, rep_name: str, min_len: int = 200, max_len: int = 20000):
    # Drop empty/short items and hard-trim to keep token counts sane

    out = []
    idx_keep = []

    rep_name = rep_name.lower()
    rep_name_words = rep_name.split()

    for i, text in enumerate(items):
        text = text.strip().lower().replace(rep_name, "")
        for word in rep_name_words:
            text = text.replace(word, "")

        if len(text) < min_len:
            continue

        out.append(text[:max_len])
        idx_keep.append(i)

    return out, idx_keep


def label_with_tfidf(cluster_texts, top_k: int = 2):
    tfidf_vectorizer = TfidfVectorizer(
        ngram_range=(1, 2), max_features=2000, stop_words="english"
    )

    # Fit and get TF-IDF vectors for each of the articles
    X = tfidf_vectorizer.fit_transform(cluster_texts)

    # Compute the average TF-IDF score of each term across each article
    scores = np.asarray(X.mean(axis=0)).ravel()

    # Get the top-k highest scoring terms
    top_idx = scores.argsort()[::-1][:top_k]

    # Get the text names of each of the highest scoring term features
    feats = np.array(tfidf_vectorizer.get_feature_names_out())[top_idx]
    return ", ".join(feats)


def cluster_and_project(texts, num_topics: int = 5, random_state: int = 42):
    # Embed the articles
    embeddings = openai_embed(texts)
    embeddings = normalize(embeddings)  # shape: (N, D) L2 normalized embeddings

    # K-Means Clustering
    k = max(1, min(num_topics, len(texts)))
    kmeans_model = KMeans(n_clusters=k, n_init=10, random_state=random_state)

    # Get cluster ids for each of the articles
    labels = kmeans_model.fit_predict(embeddings)  # shape: (N) cluster ids

    # Topic labels via TF-IDF per cluster
    titles = {}

    # For each cluster, get the text and create a topic label with TF-IDF
    for c in range(k):
        idxs = np.where(labels == c)[0]
        if idxs.size == 0:
            titles[c] = f"Cluster {c}"
            continue

        titles[c] = (
            label_with_tfidf([texts[i] for i in idxs], top_k=2) or f"Cluster {c}"
        )

    # 2D projection with t-SNE and PCA
    tsne = TSNE(
        n_components=2,
        perplexity=10,  # 5 – 50
        learning_rate="auto",
        init="random",
        random_state=random_state,
        metric="cosine",
    )
    tsne_coordinates = tsne.fit_transform(
        embeddings
    )  # shape: (N, 2) projected coordinates

    pca_model = PCA(n_components=2, random_state=random_state)
    pca_coordinates = pca_model.fit_transform(
        embeddings
    )  # shape: (N, 2) projected coordinates

    return labels, titles, tsne_coordinates, pca_coordinates, embeddings


def get_projected_article_data(
    article_data,
    rep_name: str,
    num_topics: int = 5,
    show_plot: bool = False,
):
    df = pd.DataFrame(article_data)

    # Clean texts
    texts_clean, keep_idx = clean_texts(df["text"].tolist(), rep_name)
    if not texts_clean:
        raise ValueError("No sufficiently long articles after cleaning")

    df = df.iloc[keep_idx].reset_index(drop=True)

    # Cluster and project
    labels, titles, tsne_coordinates, pca_coordinates, embeddings = cluster_and_project(
        texts_clean, num_topics=num_topics, random_state=42
    )

    df["cluster"] = labels
    df["topic"] = [titles[c].title() for c in labels]

    df["tsne_x"] = tsne_coordinates[:, 0]
    df["tsne_y"] = tsne_coordinates[:, 1]

    df["pca_x"] = pca_coordinates[:, 0]
    df["pca_y"] = pca_coordinates[:, 1]

    if show_plot:
        # Plot (color by cluster and label with topic names)
        plt.figure(figsize=(7, 6))

        scatter = plt.scatter(
            df["tsne_x"], df["tsne_y"], c=df["cluster"], s=60, alpha=0.9
        )

        plt.title(f'Articles on "{rep_name}" (t-SNE)')
        plt.xlabel("x")
        plt.ylabel("y")

        # Build a legend with one entry per cluster using TF-IDF titles
        handles, _ = scatter.legend_elements(prop="colors")

        # Order the legend entries by cluster id to align labels
        sorted_clusters = sorted(df["cluster"].unique())
        legend_labels = [
            f"{c}: {titles.get(c, f'Cluster {c}')}" for c in sorted_clusters
        ]

        plt.legend(
            handles[: len(sorted_clusters)],
            legend_labels,
            title="Clusters / Topics",
            loc="best",
            fontsize=8,
        )

        # Annotate with short titles
        for _, r in df.iterrows():
            short = (r.get("title") or "").strip()
            if short:
                short = (short[:35] + "…") if len(short) > 36 else short
                plt.annotate(short, (r["x"], r["y"]), fontsize=7, alpha=0.75)

        plt.tight_layout()
        plt.show()

        # Print topics summary (largest first)
        print("\nTop topics:")
        for c, grp in df.groupby("cluster"):
            print(f"[{c}] {titles[c]} — {len(grp)} articles")

    return df


if __name__ == "__main__":
    rep_name = "Rep. Nikema Williams"
    num_topics = 5

    # Fetch articles
    rss_items = get_google_news_articles_rss(rep_name, limit=25)
    rss_links = [a.link for a in rss_items]

    article_links = get_google_rss_redirect_links(rss_links)
    article_data = scrape_articles(article_links)

    result_df = get_projected_article_data(
        article_data, rep_name, num_topics, show_plot=True
    )

    print(result_df)
    print(result_df.columns)
