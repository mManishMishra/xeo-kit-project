require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// 1. Ensure the dynamic 'jobs' directory exists
const jobsDir = path.join(__dirname, 'jobs');
if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir);

// 2. Serve the jobs folder publicly so React can load the HTML iframe
app.use('/jobs', express.static(jobsDir));

// 3. Configure Multer for Dynamic Folders
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uniqueFolder = path.join(jobsDir, `job_${Date.now()}`);
    fs.mkdirSync(uniqueFolder, { recursive: true });
    cb(null, uniqueFolder);
  },
  filename: function (req, file, cb) {
    cb(null, 'input.ifc'); 
  }
});
const upload = multer({ storage: storage });

app.post('/api/render', upload.single('ifcFile'), (req, res) => {
  try {
    const angle = req.body.angle || '360';
    const jobDir = req.file.destination; 
    const jobId = path.basename(jobDir); 

    console.log(`\n--- Render Request | Angle: ${angle} | Job ID: ${jobId} ---`);

    // 4. Pass the dynamic folder to the pipeline!
    execSync(`node aps-pipeline.js ${angle} "./jobs/${jobId}"`, { stdio: 'inherit' });

    // 5. Return the URL format so React knows how to display it
   // Automatically detect if we are on Render (https) or local (http)
const protocol = req.headers['x-forwarded-proto'] || req.protocol;
const host = req.headers.host; // This will be 'xeo-kit-project.onrender.com' in production
const baseUrl = `${protocol}://${host}`;

if (angle === '360') {
   res.json({ type: '360', url: `${baseUrl}/jobs/${jobId}/360_viewer.html` });
} else {
   res.json({ type: 'image', url: `${baseUrl}/jobs/${jobId}/result.png` });
}

  } catch (error) {
    console.error("Render API Error:", error.message);
    res.status(500).json({ error: 'Failed to process render' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dynamic Render Server running on http://localhost:${PORT}`);
});