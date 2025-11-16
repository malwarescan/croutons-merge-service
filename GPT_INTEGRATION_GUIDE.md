# GPT Integration Guide - Bangkok Massage Merge Service

Complete guide for integrating the Croutons Merge Service with GPT agents.

---

## 1. Function Definition for GPT Config

Add this to your GPT's function schema:

```json
{
  "name": "invoke_bkk_merge",
  "description": "Call the Croutons Merge API to retrieve verified, district-aware massage intelligence for Bangkok. Returns merged data from Google Maps and verified corpus sources.",
  "parameters": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "User's Bangkok massage query (e.g., 'Find a safe massage in Asok', 'What are the prices in Nana?', 'Show me shops with prettiest women')"
      },
      "task": {
        "type": "string",
        "enum": ["legitimacy_scoring", "district_aware_ranking", "safety_pattern_recognition", "price_sanity_checking"],
        "description": "Inferred analysis task type. Use 'district_aware_ranking' for general recommendations, 'legitimacy_scoring' for safety checks, 'safety_pattern_recognition' for safety patterns, 'price_sanity_checking' for pricing queries."
      },
      "region": {
        "type": "string",
        "enum": ["Asok", "Nana", "Phrom Phong", "Thonglor", "Ekkamai", "Silom", "Ari", "Victory Monument", "Ratchada", "Old City"],
        "description": "Extracted Bangkok district from user query. Leave empty if not specified."
      }
    },
    "required": ["content"]
  }
}
```

**File:** `GPT_FUNCTION_DEFINITION.json` (included in repo)

---

## 2. Handler Implementation

### Option A: Node.js/Express Backend

```javascript
import { invoke_bkk_merge } from './src/handlers/invokeBkkMerge.js';

// In your GPT function router
app.post('/functions/invoke_bkk_merge', async (req, res) => {
  try {
    const { content, task, region } = req.body;
    const result = await invoke_bkk_merge({ content, task, region });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Option B: Direct Function Call

```javascript
import { invoke_bkk_merge } from './src/handlers/invokeBkkMerge.js';

// When GPT calls the function
const result = await invoke_bkk_merge({
  content: "Find a safe massage in Asok",
  task: "district_aware_ranking",
  region: "Asok"
});
```

**File:** `src/handlers/invokeBkkMerge.js` (included in repo)

---

## 3. GPT Integration Logic

### System Prompt Addition

Add this to your GPT's system prompt:

```
**Bangkok Massage Intelligence:**

When users ask about massage services in Bangkok, you MUST call invoke_bkk_merge with:
- content: User's full question
- task: Infer from user intent:
  - "district_aware_ranking" - User asks for recommendations (default)
  - "legitimacy_scoring" - User asks if a shop is legitimate/safe
  - "safety_pattern_recognition" - User asks about safety patterns
  - "price_sanity_checking" - User asks about pricing
- region: Extract district from user message if mentioned (Asok, Nana, Phrom Phong, Thonglor, Ekkamai, Silom, Ari, Victory Monument, Ratchada, Old City)

**After calling invoke_bkk_merge:**
1. Format the response into a friendly, conversational answer
2. List shops with name, address, rating, review count
3. Include prettiest women mentions if available
4. Show pricing information if available
5. Display Line usernames if available
6. Include websites if available
7. Highlight overall ratings and safety signals
```

### Routing Logic

```javascript
function shouldCallBkkMerge(query) {
  const lowerQuery = query.toLowerCase();
  const hasMassage = lowerQuery.includes("massage");
  const hasBangkok = lowerQuery.includes("bangkok") || lowerQuery.includes("bkk");
  const hasDistrict = [
    "asok", "nana", "phrom phong", "thonglor", "ekkamai",
    "silom", "ari", "victory monument", "ratchada", "old city"
  ].some(district => lowerQuery.includes(district));
  
  return hasMassage && (hasBangkok || hasDistrict);
}

function inferTask(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes("price") || lowerQuery.includes("cost")) {
    return "price_sanity_checking";
  }
  if (lowerQuery.includes("safe") || lowerQuery.includes("legitimate") || lowerQuery.includes("verify")) {
    return "legitimacy_scoring";
  }
  if (lowerQuery.includes("safety") || lowerQuery.includes("risk")) {
    return "safety_pattern_recognition";
  }
  return "district_aware_ranking"; // default
}

function extractRegion(query) {
  const districts = [
    "Asok", "Nana", "Phrom Phong", "Thonglor", "Ekkamai",
    "Silom", "Ari", "Victory Monument", "Ratchada", "Old City"
  ];
  
  const lowerQuery = query.toLowerCase();
  for (const district of districts) {
    if (lowerQuery.includes(district.toLowerCase())) {
      return district;
    }
  }
  return null;
}

// In your GPT message handler
if (shouldCallBkkMerge(userMessage)) {
  const task = inferTask(userMessage);
  const region = extractRegion(userMessage);
  
  const result = await invoke_bkk_merge({
    content: userMessage,
    task,
    region: region || "",
  });
  
  // Format result for user
  return formatBkkMassageResponse(result);
}
```

---

## 4. Environment Configuration

Set the API URL in your environment:

```bash
# .env or environment variables
BKK_MERGE_API_URL=https://<your-app>.up.railway.app/v1/merge/bkk_massage
```

**Replace `<your-app>` with your Railway deployment subdomain.**

---

## 5. Health Check

### Test Connection

```javascript
import { checkMergeAPIHealth } from './src/handlers/invokeBkkMerge.js';

const health = await checkMergeAPIHealth();
console.log(health);
// Expected: { status: "ok", connected: true, time: "..." }
```

### Manual Test

```bash
curl https://<your-app>.up.railway.app/v1/merge/health
```

**Expected response:**
```json
{
  "status": "ok",
  "connected": true,
  "time": "2025-01-05T12:00:00.000Z",
  "service": "croutons-merge-service"
}
```

---

## 6. Example Queries

### Query 1: District Recommendation
**User:** "Where can I get a massage in Asok?"

**GPT Function Call:**
```json
{
  "name": "invoke_bkk_merge",
  "arguments": {
    "content": "Where can I get a massage in Asok?",
    "task": "district_aware_ranking",
    "region": "Asok"
  }
}
```

**Expected Response:**
```json
{
  "ok": true,
  "shops": [
    {
      "name": "Example Massage",
      "address": "123 Asok Road",
      "rating": 4.5,
      "review_count": 50,
      "prettiest_women": ["Mentioned in reviews"],
      "pricing": ["500 THB"],
      "line_usernames": ["@example"],
      "websites": ["https://example.com"],
      "verified": true,
      "safety_signals": ["Well-lit", "Public area"]
    }
  ],
  "count": 1
}
```

### Query 2: Pricing
**User:** "What are the prices in Nana?"

**GPT Function Call:**
```json
{
  "name": "invoke_bkk_merge",
  "arguments": {
    "content": "What are the prices in Nana?",
    "task": "price_sanity_checking",
    "region": "Nana"
  }
}
```

### Query 3: Safety Check
**User:** "Is this shop safe for solo women?"

**GPT Function Call:**
```json
{
  "name": "invoke_bkk_merge",
  "arguments": {
    "content": "Is this shop safe for solo women?",
    "task": "legitimacy_scoring",
    "region": ""
  }
}
```

---

## 7. Response Formatting

Format the API response for user display:

```javascript
function formatBkkMassageResponse(apiResponse) {
  if (!apiResponse.ok || !apiResponse.shops || apiResponse.shops.length === 0) {
    return "No massage shops found matching your criteria.";
  }

  let text = `**Bangkok Massage Recommendations**\n\n`;
  
  apiResponse.shops.forEach((shop, idx) => {
    text += `${idx + 1}. **${shop.name}**\n`;
    
    if (shop.address) {
      text += `   📍 ${shop.address}\n`;
    }
    
    if (shop.rating) {
      text += `   ⭐ ${shop.rating}/5`;
      if (shop.review_count) {
        text += ` (${shop.review_count} reviews)`;
      }
      text += `\n`;
    }
    
    if (shop.prettiest_women && shop.prettiest_women.length > 0) {
      text += `   💃 Prettiest women mentions: ${shop.prettiest_women.join(", ")}\n`;
    }
    
    if (shop.pricing && shop.pricing.length > 0) {
      text += `   💰 Pricing: ${shop.pricing.join(", ")}\n`;
    }
    
    if (shop.line_usernames && shop.line_usernames.length > 0) {
      text += `   📱 Line: ${shop.line_usernames.join(", ")}\n`;
    }
    
    if (shop.websites && shop.websites.length > 0) {
      text += `   🌐 Website: ${shop.websites.join(", ")}\n`;
    }
    
    if (shop.verified) {
      text += `   ✅ Verified\n`;
    }
    
    if (shop.safety_signals && shop.safety_signals.length > 0) {
      text += `   🛡️ Safety: ${shop.safety_signals.join(", ")}\n`;
    }
    
    text += `\n`;
  });
  
  return text;
}
```

---

## 8. Testing Checklist

- [ ] Function definition added to GPT config
- [ ] Handler implementation added to backend
- [ ] System prompt updated with Bangkok massage section
- [ ] Routing logic implemented
- [ ] Environment variable `BKK_MERGE_API_URL` set
- [ ] Health check endpoint tested
- [ ] Test query: "Find a safe massage in Asok"
- [ ] Test query: "What are the prices in Nana?"
- [ ] Test query: "Show me shops with prettiest women"
- [ ] Response formatting verified

---

## 9. Troubleshooting

### API Not Responding
- Check Railway deployment is live
- Verify `BKK_MERGE_API_URL` is set correctly
- Test health endpoint: `curl https://<your-app>.up.railway.app/v1/merge/health`

### Function Not Being Called
- Verify function definition is in GPT config
- Check system prompt includes Bangkok massage section
- Test routing logic with `shouldCallBkkMerge()`

### Empty Results
- Check corpus files are loaded
- Verify Redis/SQLite cache is working
- Check API logs in Railway

---

## 10. Quick Start

1. **Add function definition** from `GPT_FUNCTION_DEFINITION.json`
2. **Add handler** from `src/handlers/invokeBkkMerge.js`
3. **Set environment variable:** `BKK_MERGE_API_URL=https://<your-app>.up.railway.app/v1/merge/bkk_massage`
4. **Update system prompt** with Bangkok massage section
5. **Test:** Ask GPT "Find a safe massage in Asok"

---

**Ready to integrate!** ✅

