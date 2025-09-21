<h1>Samsug Memory Lens</h1>
<h3>A cloud enabled Intelligent Memory Recall Framework (IMRF) using AWS<h3>
  <hr>
<h2>1. Introduction</h2>
        <p align="justify">This project is a comprehensive solution designed to revolutionize how users interact with their personal media libraries. By leveraging advanced cloud-based AI and vector database technologies, it transforms a standard media gallery into an intelligent, searchable archive. Users can query their collection of images and videos using natural language, moving beyond simple metadata or keyword searches to a more intuitive and powerful semantic understanding of their content.</p>
        <p align="justify">The core of this system is the integration of <strong>AWS Rekognition</strong> for deep media analysis and <strong>Qdrant</strong>, a high-performance vector database, to enable real-time semantic search. This allows for complex queries such as "Show me pictures from my beach vacation last summer" or "Find the photo with the Wi-Fi password from the cafe."</p>
<h2>2. Core Concepts</h2>
        <h3>2.1. AWS Rekognition: Media Analysis</h3>
        <p>AWS Rekognition is a cloud-based service that provides sophisticated image and video analysis. In this project, it serves as the primary engine for extracting meaningful information from media files. Its key functions include:</p>
        <ul>
            <li><strong>Object and Scene Detection:</strong> Identifying objects (e.g., cars, trees, laptops), scenes (e.g., beach, city, party), and activities within an image or video.</li>
            <li><strong>Facial Analysis:</strong> Detecting faces and their attributes.</li>
            <li><strong>Text Detection (OCR):</strong> Extracting and recognizing text from images, such as text on signs, documents, or posters.</li>
        </ul>
        <p align="justify">For each media file, AWS Rekognition generates a rich set of labels and metadata. This structured data forms the basis for the semantic representation of the content.</p>
<h3>2.2. Semantic Search and Vector Embeddings</h3>
        <p>Traditional search relies on matching keywords. Semantic search, however, aims to understand the <em>intent</em> and <em>context</em> behind a query. This is achieved by converting both the media metadata and the user's natural language query into high-dimensional numerical representations called <strong>vector embeddings</strong>.</p>
        <p>The process is as follows:</p>
        <ol>
            <li><strong>Indexing:</strong> The labels and text extracted by AWS Rekognition for each image are passed through a sentence-transformer model to generate a vector embedding. This vector numerically represents the semantic meaning of the image's content.</li>
            <li><strong>Storage:</strong> This embedding is stored in the <strong>Qdrant</strong> vector database, mapped to its corresponding media file.</li>
            <li><strong>Querying:</strong> When a user enters a search query (e.g., "my car parked near a restaurant"), the query is also converted into a vector embedding using the same model.</li>
            <li><strong>Similarity Search:</strong> Qdrant performs an Approximate Nearest Neighbor (ANN) search to find the vectors in the database that are closest (most similar) to the query vector. The corresponding images are then returned as the search results.</li>
        </ol>
        <p align="justify">This approach allows the system to find relevant images even if they do not contain the exact keywords used in the query.</p>
<h2>3. System Architecture</h2>
        <p align="justify">The application is built on a client-server architecture designed for scalability and performance.</p>
        <ol>
            <li><strong>Frontend (Flutter):</strong> A cross-platform mobile application that provides the user interface. It is responsible for capturing user queries, displaying media, and communicating with the backend server.</li>
            <li><strong>Backend (Node.js & Express.js):</strong> A robust API server that acts as the central orchestrator. It handles requests from the Flutter client, interacts with AWS services for media processing, and communicates with the Qdrant database for indexing and search operations.</li>
            <li><strong>AI Service (AWS Rekognition):</strong> Processes uploaded images to extract labels, text, and other relevant metadata.</li>
            <li><strong>Database (Qdrant):</strong> Stores and indexes the vector embeddings generated from the Rekognition metadata, enabling efficient and fast similarity searches.</li>
        </ol>
<h3>Data Flow</h3>
        <ol>
            <li>The Flutter app accesses the user's gallery.</li>
            <li>The backend receives the image and sends it to AWS Rekognition for analysis.</li>
            <li>Rekognition returns a set of labels and detected text.</li>
            <li>The backend generates a vector embedding from this data and stores it in the Qdrant database.</li>
            <li>When a user performs a search, the backend converts the natural language query into a vector embedding.</li>
            <li>This query vector is sent to Qdrant, which returns a list of the most similar image vectors.</li>
            <li>The backend retrieves the corresponding images and sends them to the Flutter client for display.</li>
        </ol>
 <h2>4. Technology Stack</h2>
        <table>
            <thead>
                <tr>
                    <th>Component</th>
                    <th>Technology/Service</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Frontend</strong></td>
                    <td>Flutter</td>
                </tr>
                <tr>
                    <td><strong>Backend</strong></td>
                    <td>Node.js, Express.js</td>
                </tr>
                <tr>
                    <td><strong>Database</strong></td>
                    <td>Qdrant (Vector Database)</td>
                </tr>
                <tr>
                    <td><strong>AI / ML</strong></td>
                    <td>AWS Rekognition, Sentence-Transformers</td>
                </tr>
                <tr>
                    <td><strong>Cloud Storage</strong></td>
                    <td>AWS S3</td>
                </tr>
                <tr>
                    <td><strong>Containerization</strong></td>
                    <td>Docker (for Qdrant deployment)</td>
                </tr>
            </tbody>
        </table>
 <h2>5. Getting Started</h2>
        <h3>Prerequisites</h3>
        <ul>
            <li>Node.js (v18.x or later)</li>
            <li>Flutter SDK</li>
            <li>Docker and Docker Compose</li>
            <li>AWS Account with configured IAM credentials for Rekognition and S3 access</li>
            <li><code>aws-cli</code> configured on your local machine</li>
        </ul>
 <h3>Backend Setup</h3>
        <ol>
            <li><strong>Clone the repository:</strong>
                <pre><code>git clone https://github.com/Vyomkhurana/Samsung-Memory-Lens.git
cd Samsung-Memory-Lens/backend</code></pre>
            </li>
            <li><strong>Install dependencies:</strong>
                <pre><code>npm install</code></pre>
            </li>
            <li><strong>Configure Environment Variables:</strong><br>
                Create a <code>.env</code> file in the <code>/backend</code> directory and add the following:
                <pre><code># AWS Configuration
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Qdrant Configuration
QDRANT_ENDPOINT=your-qdrant-cloud-endpoint
QDRANT_API_KEY=your-qdrant-cloud-apikey


# Server Configuration
PORT=3000</code></pre>
            </li>
        
  <li><strong>Start the backend server:</strong>
                <pre><code>npm start</code></pre>
                <p>The server should now be running on <code>http://localhost:3000</code>.</p>
            </li>
        </ol>
 <h3>Frontend Setup</h3>
        <ol>
            <li><strong>Navigate to the frontend directory:</strong>
                <pre><code>cd ../frontend</code></pre>
            </li>
            <li><strong>Get Flutter packages:</strong>
                <pre><code>flutter pub get</code></pre>
            </li>
            <li><strong>Configure API endpoint:</strong><br>
                In your Flutter project's configuration file (e.g., <code>lib/config.dart</code>), set the backend API endpoint:
                <pre><code>const String API_BASE_URL = 'http://localhost:3000/api';</code></pre>
            </li>
            <li><strong>Run the application:</strong>
                <pre><code>flutter run</code></pre>
            </li>
        </ol>

<h2>6. Developers</h2>
             <table>
            <tbody>
               <tr>
                    <td><strong>Name</strong></td>
                    <td><strong>Email ID</strong></td>
                  <td><strong>College</strong></td>
                </tr>
                <tr>
                    <td>Vyom Khurana</td>
                    <td>vyom.khurana2023@vitstudent.ac.in</td>
                  <td rowspan="4">VIT Vellore</td>
                </tr>
                <tr>
                   <td>Gurumauj Satsangi</td>
                    <td>gurumauj.satsangi2023@vitstudent.ac.in</td>
                </tr>
                <tr>
                   <td>Prakhar Aditya Misra</td>
                    <td>prakharaditya.misra2023@vitstudent.ac.in</td>
                </tr>
                <tr>
                    <td>Abhinav Sharma</td>
                    <td>abhinav.sharma2023b@vitstudent.ac.in</td>
                </tr>
               
 </tbody>
        </table>
 
</html>

