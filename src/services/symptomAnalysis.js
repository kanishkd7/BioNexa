import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const analyzeSymptoms = async (symptoms) => {
  if (!symptoms || symptoms.trim() === '') {
    return {
      specialist: 'General Physician',
      confidence: 0,
      reasoning: 'No symptoms provided. Please describe your symptoms.',
      error: 'No symptoms provided'
    };
  }

  if (!process.env.REACT_APP_OPENAI_API_KEY) {
    return {
      specialist: 'General Physician',
      confidence: 0,
      reasoning: 'API configuration error. Please check your environment settings.',
      error: 'OpenAI API key not configured'
    };
  }

  try {
    const prompt = `As a medical expert system, analyze these symptoms and recommend a specialist: ${symptoms}\n\nProvide a JSON response with:\n- recommendedSpecialist: The most appropriate medical specialist\n- confidence: A score from 0-100 indicating certainty\n- reasoning: Clear explanation for the recommendation`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 200
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    let result;
    try {
      result = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      throw new Error('Failed to parse API response');
    }

    if (!result.recommendedSpecialist || !result.confidence || !result.reasoning) {
      throw new Error('Incomplete analysis results');
    }

    return {
      specialist: result.recommendedSpecialist,
      confidence: result.confidence,
      reasoning: result.reasoning,
      error: null
    };
  } catch (error) {
    console.error('Error analyzing symptoms:', error);
    let errorMessage = 'An unexpected error occurred during symptom analysis.';
    
    if (error.message.includes('API') || error.message.includes('network') || error.message.includes('timeout')) {
      errorMessage = 'Unable to connect to the analysis service. Please check your internet connection and try again.';
    } else if (error.message.includes('parse')) {
      errorMessage = 'Error processing the analysis results. The service response was invalid.';
    } else if (error.message.includes('Incomplete')) {
      errorMessage = 'The analysis service provided incomplete results. Please try again with more detailed symptoms.';
    } else if (error.message.includes('key')) {
      errorMessage = 'API authentication error. Please check your API configuration.';
    }

    return {
      specialist: 'General Physician',
      confidence: 0,
      reasoning: errorMessage,
      error: error.message
    };

  }
};