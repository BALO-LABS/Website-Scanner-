# 🚀 WebsiteMapper Streamlit App - Ready to Deploy
# ==================================================
# Save this as: app.py

import streamlit as st
import asyncio
import httpx
from selectolax.parser import HTMLParser
import json
import time
from urllib.parse import urljoin, urlparse, urldefrag
from collections import defaultdict, deque
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# Page config
st.set_page_config(
    page_title="WebsiteMapper",
    page_icon="🕷️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .success-box {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
    }
    .metric-card {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #ddd;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
</style>
""", unsafe_allow_html=True)

class StreamlitWebsiteCrawler:
    """Streamlit-optimized website crawler."""
    
    def __init__(self, start_url, max_pages=15, max_depth=3):
        self.start_url = self._normalize_url(start_url)
        self.max_pages = max_pages
        self.max_depth = max_depth
        
        # Domain handling (www/non-www)
        parsed = urlparse(self.start_url)
        self.original_domain = parsed.netloc
        self.base_domain = self._get_base_domain(parsed.netloc)
        
        # State
        self.visited_urls = set()
        self.pages_data = {}
        self.site_structure = defaultdict(list)
        
    def _get_base_domain(self, domain):
        """Remove www prefix."""
        if domain.startswith('www.'):
            return domain[4:]
        return domain
    
    def _normalize_url(self, url):
        """Normalize URL."""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        url, _ = urldefrag(url)
        return url.rstrip('/')
    
    def _is_internal_link(self, url):
        """Check if URL is internal (ignoring www)."""
        link_domain = self._get_base_domain(urlparse(url).netloc)
        return link_domain == self.base_domain
    
    def _should_crawl_url(self, url, current_depth):
        """Check if URL should be crawled."""
        parsed = urlparse(url)
        
        if parsed.scheme not in ('http', 'https'):
            return False
        
        if not self._is_internal_link(url):
            return False
        
        if current_depth >= self.max_depth:
            return False
        
        skip_extensions = {'.pdf', '.doc', '.jpg', '.png', '.gif', '.css', '.js'}
        if any(parsed.path.lower().endswith(ext) for ext in skip_extensions):
            return False
        
        if url in self.visited_urls:
            return False
        
        return True
    
    async def _extract_page_data(self, url, depth, parent_url=""):
        """Extract page data using HTTP client."""
        try:
            async with httpx.AsyncClient(
                timeout=30,
                follow_redirects=True,
                headers={'User-Agent': 'WebsiteMapper/1.0'}
            ) as client:
                
                response = await client.get(url)
                html = response.text
                
                if 'text/html' not in response.headers.get('content-type', ''):
                    return None
                
                return self._parse_html_data(html, url, depth, parent_url)
                
        except Exception as e:
            st.warning(f"⚠️ Failed to crawl {url}: {str(e)}")
            return None
    
    def _parse_html_data(self, html, url, depth, parent_url):
        """Parse HTML and extract data."""
        tree = HTMLParser(html)
        
        # Extract title
        title_tag = tree.css_first("title")
        title = title_tag.text(strip=True) if title_tag else "No title"
        
        # Remove noise
        for tag in tree.css("script, style, nav, footer, header, aside"):
            tag.decompose()
        
        text_content = tree.text(separator=" ", strip=True)
        
        # Extract links
        internal_links = []
        external_links = []
        
        for a in tree.css("a[href]"):
            href = a.attributes.get("href", "")
            link_text = a.text(strip=True)
            if href:
                absolute_url = urljoin(url, href)
                normalized_url = self._normalize_url(absolute_url)
                
                link_info = {
                    "url": normalized_url,
                    "text": link_text
                }
                
                if self._is_internal_link(normalized_url):
                    internal_links.append(link_info)
                else:
                    external_links.append(link_info)
        
        # Extract images
        images = []
        for img in tree.css("img"):
            src = img.attributes.get("src", "")
            if src:
                images.append(urljoin(url, src))
        
        # Extract headings
        headings = []
        for i in range(1, 7):
            for h in tree.css(f"h{i}"):
                text = h.text(strip=True)
                if text:
                    headings.append({"level": i, "text": text})
        
        # Page classification
        page_type = self._classify_page_type(url, title)
        
        return {
            "url": url,
            "title": title,
            "depth": depth,
            "parent_url": parent_url,
            "page_type": page_type,
            "content": {
                "text_content": text_content,
                "word_count": len(text_content.split()),
                "char_count": len(text_content)
            },
            "structure": {
                "headings": headings,
                "internal_links": internal_links,
                "external_links": external_links,
                "images": images
            },
            "metrics": {
                "internal_links_count": len(internal_links),
                "external_links_count": len(external_links),
                "images_count": len(images),
                "headings_count": len(headings)
            }
        }
    
    def _classify_page_type(self, url, title):
        """Classify page type."""
        url_lower = url.lower()
        
        if any(pattern in url_lower for pattern in ['/', '/home', '/index']):
            return "homepage"
        elif any(pattern in url_lower for pattern in ['/about', '/team']):
            return "about"
        elif any(pattern in url_lower for pattern in ['/service', '/solution']):
            return "services"
        elif any(pattern in url_lower for pattern in ['/contact']):
            return "contact"
        elif any(pattern in url_lower for pattern in ['/blog', '/news']):
            return "blog"
        else:
            return "page"
    
    async def crawl_website(self, progress_bar, status_text):
        """Crawl website with Streamlit progress updates."""
        queue = deque([(self.start_url, 0, "")])
        crawled_count = 0
        
        while queue and crawled_count < self.max_pages:
            url, depth, parent_url = queue.popleft()
            
            if not self._should_crawl_url(url, depth):
                continue
            
            # Update progress
            progress_bar.progress((crawled_count + 1) / self.max_pages)
            status_text.text(f"Crawling ({crawled_count + 1}/{self.max_pages}): {url}")
            
            # Extract page data
            page_data = await self._extract_page_data(url, depth, parent_url)
            
            if page_data:
                self.pages_data[url] = page_data
                self.visited_urls.add(url)
                crawled_count += 1
                
                # Build site structure
                if parent_url:
                    self.site_structure[parent_url].append(url)
                
                # Add internal links to queue
                for link in page_data["structure"]["internal_links"]:
                    link_url = link["url"]
                    if self._should_crawl_url(link_url, depth + 1):
                        queue.append((link_url, depth + 1, url))
            
            await asyncio.sleep(0.5)  # Rate limiting
        
        return self.build_site_map()
    
    def build_site_map(self):
        """Build site map."""
        total_pages = len(self.pages_data)
        total_words = sum(page["content"]["word_count"] for page in self.pages_data.values())
        total_links = sum(page["metrics"]["internal_links_count"] for page in self.pages_data.values())
        total_images = sum(page["metrics"]["images_count"] for page in self.pages_data.values())
        
        # Page type distribution
        page_types = defaultdict(int)
        for page in self.pages_data.values():
            page_types[page["page_type"]] += 1
        
        return {
            "domain": self.base_domain,
            "summary": {
                "total_pages": total_pages,
                "total_words": total_words,
                "total_links": total_links,
                "total_images": total_images
            },
            "page_types": dict(page_types),
            "site_structure": dict(self.site_structure),
            "pages": self.pages_data
        }

def create_network_visualization(site_map):
    """Create interactive network visualization."""
    
    pages = site_map["pages"]
    structure = site_map["site_structure"]
    
    # Prepare data for plotly
    node_trace = go.Scatter(
        x=[], y=[],
        mode='markers+text',
        text=[],
        textposition="middle center",
        hoverinfo='text',
        marker=dict(size=[], color=[], colorscale='Viridis', showscale=True)
    )
    
    edge_trace = go.Scatter(
        x=[], y=[],
        line=dict(width=2, color='#888'),
        hoverinfo='none',
        mode='lines'
    )
    
    # Create simple layout (you can enhance this with networkx if needed)
    import math
    urls = list(pages.keys())
    n = len(urls)
    
    # Circular layout
    for i, url in enumerate(urls):
        angle = 2 * math.pi * i / n
        x = math.cos(angle)
        y = math.sin(angle)
        
        page_data = pages[url]
        node_trace['x'] += (x,)
        node_trace['y'] += (y,)
        node_trace['text'] += (page_data['title'][:20],)
        node_trace['marker']['size'] += (20,)
        node_trace['marker']['color'] += (page_data['content']['word_count'],)
    
    # Add edges
    for parent_url, child_urls in structure.items():
        if parent_url in urls:
            parent_idx = urls.index(parent_url)
            parent_x = node_trace['x'][parent_idx]
            parent_y = node_trace['y'][parent_idx]
            
            for child_url in child_urls:
                if child_url in urls:
                    child_idx = urls.index(child_url)
                    child_x = node_trace['x'][child_idx]
                    child_y = node_trace['y'][child_idx]
                    
                    edge_trace['x'] += (parent_x, child_x, None)
                    edge_trace['y'] += (parent_y, child_y, None)
    
    fig = go.Figure(data=[edge_trace, node_trace],
                    layout=go.Layout(
                        title='🗺️ Website Structure Network',
                        titlefont_size=16,
                        showlegend=False,
                        hovermode='closest',
                        margin=dict(b=20,l=5,r=5,t=40),
                        annotations=[ dict(
                            text="Node size represents word count",
                            showarrow=False,
                            xref="paper", yref="paper",
                            x=0.005, y=-0.002,
                            xanchor="left", yanchor="bottom",
                            font=dict(color="#888", size=12)
                        )],
                        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False)
                    ))
    
    return fig

# Streamlit App
def main():
    # Header
    st.markdown("""
    <div class="main-header">
        <h1>🕷️ WebsiteMapper</h1>
        <p>Map website structure • Extract content • Analyze pages</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Sidebar
    with st.sidebar:
        st.header("⚙️ Settings")
        
        url = st.text_input(
            "🌐 Website URL",
            value="https://example.com",
            help="Enter the website you want to map"
        )
        
        max_pages = st.slider(
            "📄 Max Pages",
            min_value=5,
            max_value=50,
            value=15,
            help="Maximum number of pages to crawl"
        )
        
        max_depth = st.slider(
            "🔍 Max Depth",
            min_value=1,
            max_value=5,
            value=3,
            help="How many clicks deep from homepage"
        )
        
        start_crawl = st.button("🚀 Start Mapping", type="primary")
    
    # Main content
    if start_crawl and url:
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            st.error("⚠️ Please enter a valid URL starting with http:// or https://")
            return
        
        # Progress indicators
        progress_container = st.container()
        with progress_container:
            st.info(f"🕷️ Starting to map {url}...")
            progress_bar = st.progress(0)
            status_text = st.empty()
        
        # Run crawler
        try:
            crawler = StreamlitWebsiteCrawler(url, max_pages, max_depth)
            
            # Run async function
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            site_map = loop.run_until_complete(
                crawler.crawl_website(progress_bar, status_text)
            )
            loop.close()
            
            # Clear progress
            progress_container.empty()
            
            # Display results
            display_results(site_map)
            
        except Exception as e:
            st.error(f"❌ Error during crawling: {str(e)}")
    
    else:
        # Welcome message
        st.markdown("""
        ## 👋 Welcome to WebsiteMapper!
        
        This tool helps you:
        - 🕷️ **Crawl websites** and discover all pages
        - 🗺️ **Map site structure** and relationships
        - 📊 **Analyze content** quality and metrics
        - 📄 **Export data** for further analysis
        
        ### 🚀 How to use:
        1. Enter a website URL in the sidebar
        2. Adjust crawling settings
        3. Click "Start Mapping"
        4. View the interactive results!
        
        ### 💡 Perfect for:
        - Content audits
        - SEO analysis  
        - Site migrations
        - Competitive research
        - AI training data preparation
        """)

def display_results(site_map):
    """Display crawl results."""
    
    summary = site_map["summary"]
    
    # Success message
    st.success(f"✅ Successfully mapped {summary['total_pages']} pages!")
    
    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("📄 Pages", summary['total_pages'])
    
    with col2:
        st.metric("📝 Words", f"{summary['total_words']:,}")
    
    with col3:
        st.metric("🔗 Links", summary['total_links'])
    
    with col4:
        st.metric("🖼️ Images", summary['total_images'])
    
    # Page types chart
    st.subheader("📊 Page Types Distribution")
    page_types_df = pd.DataFrame(
        list(site_map["page_types"].items()),
        columns=['Page Type', 'Count']
    )
    
    if not page_types_df.empty:
        fig_pie = px.pie(
            page_types_df, 
            values='Count', 
            names='Page Type',
            title="Distribution of Page Types"
        )
        st.plotly_chart(fig_pie, use_container_width=True)
    
    # Network visualization
    st.subheader("🗺️ Site Structure Network")
    if len(site_map["pages"]) > 1:
        try:
            network_fig = create_network_visualization(site_map)
            st.plotly_chart(network_fig, use_container_width=True)
        except Exception as e:
            st.warning(f"Could not create network visualization: {e}")
    
    # Pages table
    st.subheader("📄 All Pages Discovered")
    
    pages_data = []
    for url, page_data in site_map["pages"].items():
        pages_data.append({
            "Title": page_data["title"],
            "URL": url,
            "Type": page_data["page_type"],
            "Words": page_data["content"]["word_count"],
            "Links": page_data["metrics"]["internal_links_count"],
            "Images": page_data["metrics"]["images_count"]
        })
    
    if pages_data:
        df = pd.DataFrame(pages_data)
        st.dataframe(df, use_container_width=True)
    
    # Export data
    st.subheader("💾 Export Data")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # JSON download
        json_data = json.dumps(site_map, indent=2, ensure_ascii=False, default=str)
        st.download_button(
            label="📁 Download JSON",
            data=json_data,
            file_name=f"{site_map['domain']}_sitemap.json",
            mime="application/json"
        )
    
    with col2:
        # CSV download
        if pages_data:
            csv_data = pd.DataFrame(pages_data).to_csv(index=False)
            st.download_button(
                label="📊 Download CSV", 
                data=csv_data,
                file_name=f"{site_map['domain']}_pages.csv",
                mime="text/csv"
            )

if __name__ == "__main__":
    main()