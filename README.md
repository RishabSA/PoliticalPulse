# PoliticalPulse

![PoliticalPulse Demo](resources/PoliticalPulseQuickDemo.gif)

Try out PoliticalPulse at [https://politicalpulse.app/](https://politicalpulse.app/)

PoliticalPulse is an AI-powered tool that gives members of Congress, their staff, and constituents a real-time read of public sentiment. By scanning trusted sources, it summarizes public opinions and highlights key strengths, concerns, and opportunities for improvement.

PoliticalPulse bridges the awareness gap between representatives and their constituents. By collecting and presenting vast amounts of public information in clear, actionable insights, my game-changing tool promotes transparency, accountability, understanding, and mutual respect between our elected officials and the people.

The PoliticalPulse website uses ReactJS, TailwindCSS, and Vite. The map shows congressional districts using cartographic data from the U.S. Census.
The PoliticalPulse server uses FastAPI and the Congress.gov API to fetch the most up-to-date data on representatives.

PoliticalPulse searches the internet for news articles about the selected congressional representative. It gathers relevant news articles from the internet and then scrapes their text content using BeautifulSoup. The scraped text is processed to prevent any bias by making the representative’s name anonymous before it is is passed to the ChatGPT API to provide the user with a report that accurately summarizes the major points from the articles, analyzes the representative’s strengths and constituents’ concerns, generates a pulse score, and gives the representative several actionable improvements.

Article data is used in an algorithm that obtains embedding vectors for each article’s text and then clusters them using a K-Means algorithm. General topic labels are generated for each cluster by TF-IDF vectorizing each article’s text and selecting the terms with the highest importance. Then, t-SNE and PCA are used to visualize the clustered articles on a 2D graph.
