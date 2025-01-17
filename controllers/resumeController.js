const OpenAI = require('openai');
const pdf = require('pdf-parse');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const analyzeResume = async (req, res) => {
    try {
        console.log('Files received:', req.files);
        console.log('Body received:', req.body);
    
        if (!req.files || !req.files.resume) {
          return res.status(400).json({ 
            success: false,
            message: 'No resume file was uploaded.'
          });
        }
    // Validate request
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No files were uploaded.'
      });
    }

    if (!req.files.resume) {
      return res.status(400).json({ 
        success: false,
        message: 'Resume file is required'
      });
    }

    const { jobTitle, keywords, jobDescription } = req.body;
    
    // Validate required fields
    if (!jobTitle || !keywords) {
      return res.status(400).json({
        success: false,
        message: 'Job title and keywords are required'
      });
    }

    // Validate file type
    const resumeFile = req.files.resume;
    if (resumeFile.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Only PDF files are allowed'
      });
    }

    // Parse PDF content
    let resumeText;
    try {
        const fs = require('fs');
        const dataBuffer = fs.readFileSync(resumeFile.tempFilePath);
        const pdfData = await pdf(dataBuffer);
        resumeText = pdfData.text;
  
        if (!resumeText || resumeText.trim().length === 0) {
          throw new Error('PDF content is empty or could not be extracted');
        }
  
        // Clean up temp file
        fs.unlinkSync(resumeFile.tempFilePath);
        
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        return res.status(400).json({
          success: false,
          message: 'Could not parse PDF file. Please ensure the file is not corrupted and contains extractable text.',
          details: pdfError.message
        });
      }

    // Initial analysis with GPT-4
    const initialAnalysis = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert HR professional and ATS system analyzer. You must respond ONLY with a valid JSON object containing resume analysis data. Do not include any explanatory text outside the JSON structure.`
          },
          {
            role: "user",
            // In resumeController.js, update the user content in the initialAnalysis prompt
content: `Analyze this resume for a ${jobTitle} position. 
Keywords to match: ${keywords}
Job Description: ${jobDescription || 'Not provided'}

Resume content: ${resumeText}

Respond with ONLY a JSON object in this exact format, with no additional text:
{
  "score": <number between 0-100>,
  "skillsScore": <number between 0-100>,
  "experienceScore": <number between 0-100>,
  "educationScore": <number between 0-100>,
  "keywordsScore": <number between 0-100>,
  "formatScore": <number between 0-100>,
  "keyFindings": ["finding1", "finding2", "finding3"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "feedback": [
    {
      "category": "Skills Match",
      "score": <number between 0-100>,
      "message": "detailed feedback about skills"
    },
    {
      "category": "Experience",
      "score": <number between 0-100>,
      "message": "detailed feedback about experience"
    },
    {
      "category": "Education",
      "score": <number between 0-100>,
      "message": "detailed feedback about education"
    },
    {
      "category": "Keywords Match",
      "score": <number between 0-100>,
      "message": "detailed feedback about keyword matches"
    },
    {
      "category": "Format & Structure",
      "score": <number between 0-100>,
      "message": "detailed feedback about resume format"
    }
  ]
}`
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent formatting
        max_tokens: 2000
      });
  
      // Add safety check for response format
      let analysis;
      try {
        const responseContent = initialAnalysis.choices[0].message.content.trim();
        console.log('GPT Response:', responseContent); // Debug log
        analysis = JSON.parse(responseContent);
        
        // Validate expected structure
        const requiredFields = ['score', 'skillsScore', 'experienceScore', 'educationScore', 
                              'keywordsScore', 'formatScore', 'keyFindings', 'suggestions', 'feedback'];
        
        const missingFields = requiredFields.filter(field => !(field in analysis));
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
      } catch (parseError) {
        console.error('Raw GPT response:', initialAnalysis.choices[0].message.content);
        console.error('Parse error:', parseError);
        return res.status(500).json({
          success: false,
          message: 'Error processing analysis results',
          error: process.env.NODE_ENV === 'development' ? parseError.message : undefined
        });
      }
  
      // Modified detailed insights prompt
      const detailedInsights = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert HR professional. Provide a detailed analysis as a single string with proper formatting."
          },
          {
            role: "user",
            content: `Based on this resume analysis: ${JSON.stringify(analysis)}, 
            provide detailed HR insights and specific recommendations for improvement.
            Format your response as a single string with clear sections and bullet points.
            Consider the job title: ${jobTitle}
            Consider these keywords: ${keywords}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
  
      // Combine analyses and send response
      const finalResponse = {
        success: true,
        data: {
          ...analysis,
          detailedInsights: detailedInsights.choices[0].message.content
        }
      };
  
      res.json(finalResponse);
  
    } catch (err) {
      console.error('Error analyzing resume:', err);
      res.status(500).json({ 
        success: false,
        message: 'Error analyzing resume',
        error: process.env.NODE_ENV === 'development' ? err.toString() : 'Internal server error'
      });
    }
  };

module.exports = {
  analyzeResume
};