const express = require("express");
const bodyParser = require("body-parser");
const printer = require("printer");
const cors = require("cors");

const app = express();

// Enable CORS for web app communication
app.use(cors({
  origin: ['http://localhost:8080', 'https://localhost:8080'],
  credentials: true
}));

app.use(bodyParser.text({ type: "*/*", limit: "1mb" }));
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Get list of available printers
app.get("/printers", (req, res) => {
  try {
    const printers = printer.getPrinters();
    const printerNames = printers.map(p => ({
      name: p.name,
      status: p.status || 'unknown',
      isDefault: p.name === printer.getDefaultPrinterName()
    }));
    
    console.log(`[${new Date().toISOString()}] Printers requested: ${printerNames.length} found`);
    res.json(printerNames);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error getting printers:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Print TSPL data
app.post("/print", (req, res) => {
  const data = req.body;
  const printerName = req.query.printerName || printer.getDefaultPrinterName();
  const copies = parseInt(req.query.copies || "1", 10);
  
  if (!data) {
    return res.status(400).json({ error: "No TSPL data provided" });
  }

  if (!printerName) {
    return res.status(400).json({ error: "No printer available" });
  }

  console.log(`[${new Date().toISOString()}] Print job: ${copies} copies to ${printerName}`);
  
  try {
    let jobsSent = 0;
    let errors = [];

    for (let i = 0; i < copies; i++) {
      printer.printDirect({
        data,
        printer: printerName,
        type: "RAW",
        success: (jobID) => {
          jobsSent++;
          console.log(`[${new Date().toISOString()}] Job ${i + 1}/${copies} sent successfully, ID: ${jobID}`);
          
          // Send response after all jobs are processed
          if (jobsSent + errors.length === copies) {
            if (errors.length === 0) {
              res.json({ 
                success: true, 
                jobsSent,
                message: `${jobsSent} print job(s) sent successfully`
              });
            } else {
              res.status(207).json({
                success: false,
                jobsSent,
                errors,
                message: `${jobsSent}/${copies} jobs sent, ${errors.length} failed`
              });
            }
          }
        },
        error: (err) => {
          const errorMsg = `Job ${i + 1}/${copies} failed: ${err}`;
          errors.push(errorMsg);
          console.error(`[${new Date().toISOString()}] ${errorMsg}`);
          
          // Send response after all jobs are processed
          if (jobsSent + errors.length === copies) {
            res.status(500).json({
              success: false,
              jobsSent,
              errors,
              message: `${errors.length}/${copies} jobs failed`
            });
          }
        }
      });
    }
  } catch (e) {
    const errorMsg = `Print error: ${e.message}`;
    console.error(`[${new Date().toISOString()}] ${errorMsg}`);
    res.status(500).json({ error: errorMsg });
  }
});

const PORT = process.env.PORT || 17777;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[${new Date().toISOString()}] Rollo Local Bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`Available printers: ${printer.getPrinters().map(p => p.name).join(', ') || 'None'}`);
});