/**
 * Handler for invoke_bkk_merge GPT function
 * Calls the Croutons Merge API to retrieve verified Bangkok massage intelligence
 */

// Update this with your Railway deployment URL
const API_URL = process.env.BKK_MERGE_API_URL || "https://<your-app>.up.railway.app/v1/merge/bkk_massage";

/**
 * Invoke Bangkok Massage Merge API
 * @param {Object} params - Function parameters
 * @param {string} params.content - User's Bangkok massage query
 * @param {string} [params.task] - Task type (default: "district_aware_ranking")
 * @param {string} [params.region] - Bangkok district
 * @returns {Promise<Object>} Merged shop data from API
 */
export async function invoke_bkk_merge({ content, task, region }) {
  if (!content) {
    throw new Error("content parameter is required");
  }

  const requestBody = {
    content,
    task: task || "district_aware_ranking",
    region: region || "",
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Merge API error ${response.status}: ${response.statusText}. ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Re-throw with more context
    if (error.message.includes("Merge API error")) {
      throw error;
    }
    throw new Error(`Failed to call merge API: ${error.message}`);
  }
}

/**
 * Health check for merge API
 * @returns {Promise<Object>} Health status
 */
export async function checkMergeAPIHealth() {
  const healthUrl = API_URL.replace("/v1/merge/bkk_massage", "/v1/merge/health");
  
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        connected: false,
        error: `HTTP ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      connected: false,
      error: error.message,
    };
  }
}

