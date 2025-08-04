const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/msn_news';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let db;
let newsCollection;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db();
    newsCollection = db.collection('news');
    
    // Create sample data if collection is empty
    initializeSampleData();
  })
  .catch(error => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Initialize sample data
async function initializeSampleData() {
  try {
    const count = await newsCollection.countDocuments();
    if (count === 0) {
      const sampleNews = [
        {
          title: "Microsoft Announces New AI Features",
          content: "Microsoft today announced revolutionary AI features coming to Windows and Office suite. The new capabilities include advanced natural language processing, improved productivity tools, and enhanced security features powered by artificial intelligence.",
          author: "MSN Tech Team",
          category: "technology",
          publishedDate: new Date('2025-01-15'),
          views: 1250,
          featured: true,
          image: "/images/ai-news.jpg"
        },
        {
          title: "Global Climate Summit Reaches Agreement",
          content: "World leaders at the climate summit have reached a historic agreement on carbon reduction targets. The agreement includes commitments from over 195 countries to reduce greenhouse gas emissions by 50% by 2030.",
          author: "MSN World News",
          category: "world",
          publishedDate: new Date('2025-01-14'),
          views: 890,
          featured: false,
          image: "/images/climate-news.jpg"
        },
        {
          title: "Stock Markets Hit Record Highs",
          content: "Major stock indices reached new record highs as investor confidence continues to grow. The S&P 500, Dow Jones, and NASDAQ all posted significant gains driven by strong quarterly earnings and positive economic indicators.",
          author: "MSN Finance",
          category: "business",
          publishedDate: new Date('2025-01-13'),
          views: 2100,
          featured: true,
          image: "/images/stock-news.jpg"
        },
        {
          title: "New COVID Variant Detected",
          content: "Health officials have identified a new COVID-19 variant with increased transmissibility. The WHO is monitoring the situation closely and recommends continued vaccination efforts.",
          author: "MSN Health",
          category: "health",
          publishedDate: new Date('2025-01-12'),
          views: 1800,
          featured: false,
          image: "/images/health-news.jpg"
        },
        {
          title: "Major Sports Trade Shakes Up League",
          content: "In a surprising move, a major trade has shaken up the professional sports world. The multi-player deal is expected to significantly impact the upcoming season.",
          author: "MSN Sports",
          category: "sports",
          publishedDate: new Date('2025-01-11'),
          views: 950,
          featured: false,
          image: "/images/sports-news.jpg"
        }
      ];
      
      await newsCollection.insertMany(sampleNews);
      console.log('Sample data initialized');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

// API Routes

// GET - Get all news articles
app.get('/api/news', async (req, res) => {
  try {
    const { category, featured, limit = 10, page = 1, search } = req.query;
    
    // Build query
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (featured === 'true') {
      query.featured = true;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get news with pagination
    const news = await newsCollection
      .find(query)
      .sort({ publishedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Get total count
    const total = await newsCollection.countDocuments(query);

    res.json({
      success: true,
      data: news,
      total: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching news',
      error: error.message
    });
  }
});

// GET - Get single news article by ID
app.get('/api/news/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      });
    }

    const news = await newsCollection.findOne({ _id: new ObjectId(id) });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    // Increment views
    await newsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { views: 1 } }
    );

    news.views += 1;

    res.json({
      success: true,
      data: news
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching news article',
      error: error.message
    });
  }
});

// POST - Create new news article
app.post('/api/news', async (req, res) => {
  try {
    const { title, content, author, category, featured, image } = req.body;

    if (!title || !content || !author || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, author, and category are required'
      });
    }

    const newNews = {
      title,
      content,
      author,
      category,
      featured: featured || false,
      image: image || null,
      publishedDate: new Date(),
      views: 0
    };

    const result = await newsCollection.insertOne(newNews);

    res.status(201).json({
      success: true,
      message: 'News article created successfully',
      data: { ...newNews, _id: result.insertedId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating news article',
      error: error.message
    });
  }
});

// PUT - Update news article
app.put('/api/news/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      });
    }

    const { title, content, author, category, featured, image } = req.body;
    
    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (author) updateData.author = author;
    if (category) updateData.category = category;
    if (featured !== undefined) updateData.featured = featured;
    if (image !== undefined) updateData.image = image;

    const result = await newsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    const updatedNews = await newsCollection.findOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: 'News article updated successfully',
      data: updatedNews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating news article',
      error: error.message
    });
  }
});

// DELETE - Delete news article
app.delete('/api/news/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      });
    }

    const result = await newsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    res.json({
      success: true,
      message: 'News article deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting news article',
      error: error.message
    });
  }
});

// GET - Get news categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await newsCollection.distinct('category');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// GET - Get featured news
app.get('/api/featured', async (req, res) => {
  try {
    const featuredNews = await newsCollection
      .find({ featured: true })
      .sort({ publishedDate: -1 })
      .limit(5)
      .toArray();

    res.json({
      success: true,
      data: featuredNews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured news',
      error: error.message
    });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'MSN News API is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`MSN News API Server running on port ${PORT}`);
});