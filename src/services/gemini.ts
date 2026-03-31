import { GoogleGenAI } from "@google/genai";
import { SaleEntry, BusinessAlert, AIInsight, ItemSale, MenuInsight } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMenuAnalysis(itemSales: ItemSale[]) {
  const prompt = `
    Analyze the following restaurant item-wise sales data.
    Identify which items should be promoted (high potential but maybe low volume), which should be removed (low revenue and low volume), and which should be optimized (high volume but low margin or other issues).
    
    Data: ${JSON.stringify(itemSales)}
    
    Return the response in JSON format:
    {
      "menuInsights": [
        {
          "itemName": "string",
          "action": "promote" | "remove" | "optimize",
          "reason": "string",
          "suggestion": "string"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text;
    if (!text) return { menuInsights: [] };
    return JSON.parse(text) as { menuInsights: MenuInsight[] };
  } catch (error) {
    console.error("Error analyzing menu:", error);
    return { menuInsights: [] };
  }
}

export async function getSalesAnalysis(sales: SaleEntry[]) {
  const prompt = `
    Analyze the following restaurant sales data and provide 3 key insights for business fine-tuning.
    Data: ${JSON.stringify(sales)}
    
    Return the response in JSON format:
    {
      "insights": [
        { "type": "growth" | "efficiency" | "marketing", "title": "string", "content": "string" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text;
    if (!text) return { insights: [] };
    return JSON.parse(text) as { insights: AIInsight[] };
  } catch (error) {
    console.error("Error analyzing sales:", error);
    return { insights: [] };
  }
}

export async function getUpcomingAlerts(currentDate: string) {
  const prompt = `
    Identify upcoming holidays and Tamil special days (like Amavasya, Pournami, Sashti, Pradosham, or festivals) for the next 14 days starting from ${currentDate}.
    Be creative and ensure at least 2-3 significant days are identified if possible, even if they are minor local events.
    For Tamil special days, suggest if production (especially non-veg) should be reduced.
    For holidays, suggest special offers.
    
    Return the response in JSON format:
    {
      "alerts": [
        {
          "date": "YYYY-MM-DD",
          "title": "string",
          "type": "holiday" | "tamil-special",
          "description": "string",
          "recommendation": "string"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text;
    if (!text) return { alerts: [] };
    const parsed = JSON.parse(text) as { alerts: BusinessAlert[] };
    
    // Fallback if AI returns nothing, to ensure UI is working
    if (parsed.alerts.length === 0) {
      return {
        alerts: [
          {
            date: currentDate,
            title: "Regular Business Day",
            type: "holiday",
            description: "No major holidays or Tamil special days identified for today.",
            recommendation: "Focus on standard operations and customer satisfaction."
          }
        ]
      };
    }
    return parsed;
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return { alerts: [] };
  }
}

export async function getGrowthPlan(sales: SaleEntry[], context: string) {
  const prompt = `
    Based on these sales: ${JSON.stringify(sales)}
    And this context: ${context}
    Provide a detailed plan to increase restaurant business.
    Include marketing ideas, menu tweaks, and operational improvements.
    
    Return the response in Markdown format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt
    });
    return response.text || "Could not generate plan at this time.";
  } catch (error) {
    console.error("Error getting growth plan:", error);
    return "Could not generate plan at this time.";
  }
}
