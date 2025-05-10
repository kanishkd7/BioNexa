const GEMINI_API_KEY = 'AIzaSyBL6D-PRgJ-YFCDobQKhbYGnfzZz6JE3hY';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

// Define the analyzeSymptoms function
const analyzeSymptoms = async (symptoms) => {
  try {
    if (!symptoms || symptoms.trim() === '') {
      throw new Error('Please provide symptoms to analyze');
    }

    const prompt = `As a medical AI assistant, analyze the following symptoms and recommend appropriate medical specializations. 
    Symptoms: ${symptoms}
    
    Please provide:
    1. A list of relevant medical specializations (at least 1, maximum 3)
    2. A brief explanation of why each specialization is recommended (2-3 sentences)
    3. The urgency level (Low/Medium/High) based on symptom severity and duration
    
    Format the response as JSON with the following structure:
    {
      "specializations": ["specialization1", "specialization2"],
      "explanations": {
        "specialization1": "explanation1",
        "specialization2": "explanation2"
      },
      "urgency": "Low/Medium/High"
    }`;

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(`API Error: ${errorData.error?.message || 'Failed to analyze symptoms'}`);
    }

    const data = await response.json();
    console.log('API Response:', data); // For debugging

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from API');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    console.log('AI Response Text:', aiResponse); // For debugging
    
    let parsedResponse;
    try {
      // Clean the response text to ensure it's valid JSON
      const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response:', aiResponse);
      throw new Error('Failed to parse AI response. Please try again.');
    }

    // Validate response structure
    if (!parsedResponse.specializations || !parsedResponse.explanations || !parsedResponse.urgency) {
      console.error('Invalid response structure:', parsedResponse);
      throw new Error('Invalid response format from AI service');
    }

    return parsedResponse;
  } catch (error) {
    console.error('Error in analyzeSymptoms:', error);
    if (error.message.includes('API key')) {
      throw new Error('AI service configuration error. Please contact support.');
    }
    throw error;
  }
};

// Export the function
export { analyzeSymptoms }; 