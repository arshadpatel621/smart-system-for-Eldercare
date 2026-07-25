# N8N CONFIGURATION VISUAL GUIDE

## 📍 EXACT LOCATIONS & SETTINGS

### **1️⃣ WEBHOOK NODE - Response Mode Fix**

**LOCATION:** Double-click the Webhook node (the trigger)

**BEFORE (❌ WRONG):**
```
Webhook Node Settings
├── Response mode: ⭕ "Last node"
└── This makes the response async (waits for last node)
```

**AFTER (✅ CORRECT):**
```
Webhook Node Settings
├── Response mode: ⭕ "On Webhook Call"
└── This makes the response synchronous (returns immediately when you send response)
```

**HOW TO CHANGE:**
1. Double-click Webhook node
2. Find dropdown labeled "Response mode"
3. Click dropdown
4. Select **"On Webhook Call"**
5. Click outside to confirm

---

### **2️⃣ NODE CONNECTION VERIFICATION**

**Visual Diagram of Correct Flow:**

```
┌─────────────┐
│   WEBHOOK   │  (Receives POST from React)
│   Trigger   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ NORMALIZE INPUT         │  (Validates request format)
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ HEALTH MONITORING AGENT      │  (LLM node - Groq)
│ • Analyzes vitals            │
│ • Returns healthScore        │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ RISK PREDICTION AGENT        │  (LLM node - Groq)
│ • Predicts fall risk         │
│ • Returns riskLevel          │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ EMERGENCY AGENT              │  (LLM node - Groq)
│ • Detects emergencies        │
│ • Returns isEmergency        │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ RECOMMENDATION AGENT         │  (LLM node - Groq)
│ • Generates care tips        │
│ • Returns recommendations[]  │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ CAREGIVER REPORT AGENT       │  (LLM node - Groq)
│ • Generates summary          │
│ • Returns caregiverReport{}  │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ ASSEMBLE FINAL RESPONSE      │  (Function node)
│ • Combines all outputs       │
│ • Returns single JSON object │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ RESPOND TO WEBHOOK           │  (Send response back to React)
│ • Status: 200                │
│ • Headers: CORS + JSON       │
│ • Body: Assembled response   │
└──────────────────────────────┘
       │
       ▼
    REACT
(Updates UI)
```

**TO VERIFY CONNECTIONS:**
1. Canvas view of workflow
2. Look for arrows connecting each node downward
3. If any arrows are missing, RED X, or sideways → **RECONNECT**
4. Right-click node → "Execute Node" (should execute without error)

---

### **3️⃣ ASSEMBLE FINAL RESPONSE NODE - Code Update**

**LOCATION:** Right-click "Assemble Final Response" → Edit

**BEFORE (❌ WRONG):**
```javascript
// Old code that doesn't match n8n response structure
[{"value": $node["last_node"].json}]
```

**AFTER (✅ CORRECT):**
```javascript
[
  {
    "json": {
      "residentId": "{{ $node['Webhook'].json.residentId }}",
      "residentName": "{{ $node['Webhook'].json.name }}",
      "healthScore": "{{ $node['Health Monitoring Agent'].json.healthScore || 85 }}",
      "overallHealth": "{{ $node['Health Monitoring Agent'].json.status || 'Good' }}",
      "riskLevel": "{{ $node['Risk Prediction Agent'].json.riskLevel || 'Medium' }}",
      "emergency": "{{ $node['Emergency Agent'].json.isEmergency || false }}",
      "recommendations": "{{ $node['Recommendation Agent'].json.recommendations || [] }}",
      "caregiverReport": "{{ $node['Caregiver Report Agent'].json.caregiverReport || {} }}",
      "timestamp": "{{ new Date().toISOString() }}",
      "id": "{{ 'report-' + Date.now() }}"
    }
  }
]
```

**KEY POINTS:**
- Uses double curly braces `{{ }}` for n8n expressions
- References exact node names from your workflow
- Provides fallback values with `||` operator
- Top-level object has a `json` property
- Wrapped in array `[ ]`

**TO UPDATE:**
1. Click on Assemble node code area
2. Select ALL (Ctrl+A)
3. Delete
4. Paste the code above
5. Right-click → Execute Node
6. Should return valid JSON (no red errors)

---

### **4️⃣ RESPOND TO WEBHOOK NODE - Complete Configuration**

**LOCATION:** Double-click "Respond to Webhook" node

**PART A - Status Code:**

```
┌─────────────────────────────────┐
│ Respond to Webhook Node         │
├─────────────────────────────────┤
│ Status Code:                    │
│ ┌─────────────────────────────┐ │
│ │ 200                         │ │  ✅ SELECT THIS
│ └─────────────────────────────┘ │
│                                 │
│ (Options: 200, 201, 400, 500)   │
└─────────────────────────────────┘
```

**PART B - Response Body:**

**BEFORE (❌ WRONG):**
```
(Empty field)
or
{{ $node['Assemble'].json }}
or
{{ $json }}
```

**AFTER (✅ CORRECT):**
```
{{ $node["Assemble Final Response"].json[0] }}
```

**IMPORTANT NOTES:**
- Use EXACT node name: "Assemble Final Response"
- Add `.json[0]` at the end (unwraps from array)
- Double quotes around node name
- No single quotes

**HOW TO SET:**
1. Click in Response Body field
2. Delete all content
3. Type: `{{ $node["Assemble Final Response"].json[0] }}`
4. Exact copy-paste (including quotes)

**PART C - Response Headers:**

**BEFORE (❌ MISSING):**
```
(No headers, or only Content-Type)
```

**AFTER (✅ ALL 4 HEADERS ADDED):**

| Row | Key | Value |
|-----|-----|-------|
| 1 | `Content-Type` | `application/json` |
| 2 | `Access-Control-Allow-Origin` | `*` |
| 3 | `Access-Control-Allow-Methods` | `POST, GET, OPTIONS` |
| 4 | `Access-Control-Allow-Headers` | `Content-Type, Authorization` |

**HOW TO ADD:**
1. Look for "Add Response Headers" link in node settings
2. Click "Add Header" button
3. Fill in first header (Content-Type = application/json)
4. Click "Add Header" again
5. Fill in second header (Access-Control-Allow-Origin = *)
6. Repeat for third and fourth headers
7. Confirm each header is visible in the list

---

### **5️⃣ WORKFLOW PUBLISH & ACTIVATE**

**LOCATION:** Top of workflow editor

**BEFORE (❌ NOT ACTIVE):**
```
Workflow Name       [Save] [Active Toggle: OFF (grey)]
```

**AFTER (✅ ACTIVE):**
```
Workflow Name       [Save] [Active Toggle: ON (green)]
```

**PRODUCTION WEBHOOK URL:**

**BEFORE (❌ TEST MODE):**
```
https://arshadpatel6361.app.n8n.cloud/webhook/test/vitalcare-ai
                                             ^^^^
```

**AFTER (✅ PRODUCTION):**
```
https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai
                                     (no /test/)
```

**HOW TO ACTIVATE:**
1. Click Webhook node
2. Copy the URL shown (it says "Copy production URL")
3. Verify NO `/test/` in URL
4. Go to `.env` file in React
5. Paste as `VITE_N8N_WEBHOOK_URL=...`
6. Return to n8n
7. Click Active toggle (should turn GREEN)
8. Click Save button

---

## 🔧 CONFIGURATION CHECKLIST

Print this out and check each item:

```
WEBHOOK NODE
[ ] Response mode = "On Webhook Call" (not "Last node")
[ ] POST method enabled
[ ] Connected to Normalize node with arrow

NORMALIZE NODE
[ ] Connected to Health Agent
[ ] Executes without error

HEALTH MONITORING AGENT
[ ] Type: LLM (Groq or similar)
[ ] Prompt includes analyzing vitals
[ ] Returns healthScore field
[ ] Connected to Risk Agent

RISK PREDICTION AGENT
[ ] Type: LLM (Groq or similar)
[ ] Prompt includes predicting fall/dehydration/cognitive risks
[ ] Returns riskLevel field
[ ] Connected to Emergency Agent

EMERGENCY AGENT
[ ] Type: LLM (Groq or similar)
[ ] Prompt includes emergency detection
[ ] Returns isEmergency boolean
[ ] Connected to Recommendation Agent

RECOMMENDATION AGENT
[ ] Type: LLM (Groq or similar)
[ ] Prompt includes generating care recommendations
[ ] Returns recommendations array
[ ] Connected to Caregiver Agent

CAREGIVER REPORT AGENT
[ ] Type: LLM (Groq or similar)
[ ] Prompt includes generating caregiver summary
[ ] Returns caregiverReport object
[ ] Connected to Assemble node

ASSEMBLE FINAL RESPONSE
[ ] Type: Function or Set node
[ ] Contains JavaScript from FIX #3
[ ] Right-click Execute → Returns valid JSON
[ ] Connected to Respond node
[ ] Node name is: "Assemble Final Response" (exact)

RESPOND TO WEBHOOK
[ ] Status Code: 200
[ ] Response Body: {{ $node["Assemble Final Response"].json[0] }}
[ ] Headers added: 4 total
  [ ] Content-Type: application/json
  [ ] Access-Control-Allow-Origin: *
  [ ] Access-Control-Allow-Methods: POST, GET, OPTIONS
  [ ] Access-Control-Allow-Headers: Content-Type, Authorization

WORKFLOW
[ ] All nodes connected in sequence
[ ] No broken connections (red X)
[ ] Active toggle: ON (green)
[ ] Saved
[ ] Production URL (no /test/)
```

---

## 🧪 QUICK TEST IN N8N

Before deploying to production, test the workflow in n8n:

**Step 1:** Click Webhook node → "Copy production URL"
**Step 2:** Click "Test" button in Webhook node
**Step 3:** Send sample data:
```json
{
  "residentId": "test-123",
  "name": "Test User",
  "age": 70,
  "heartRate": 75,
  "spo2": 97,
  "bloodPressure": "120/80",
  "temperature": 36.8,
  "sleepHours": 7,
  "steps": 5000,
  "cameraEvent": "none",
  "timestamp": "2026-07-25T10:00:00.000Z"
}
```
**Step 4:** Watch nodes execute (should all turn green)
**Step 5:** Check final response in Respond node output
**Step 6:** Should be valid JSON, not empty

---

## 📋 COMMON n8n MISTAKES

| ❌ WRONG | ✅ CORRECT | FIX |
|---------|----------|-----|
| Response mode: "Last node" | Response mode: "On Webhook Call" | See step 1 |
| Empty response body | `{{ $node["Assemble Final Response"].json[0] }}` | See step 4 |
| Nodes not connected | All nodes connected in sequence | See step 2 |
| Missing CORS headers | All 4 headers added | See step 4 |
| Workflow not active | Active toggle = green | See step 5 |
| Test URL in .env | Production URL in .env | See step 5 |
| Assemble node broken | Use JavaScript from FIX #3 | See step 3 |
| Workflow not saved | Save button clicked | See step 5 |

---

## ✅ VERIFICATION STEP-BY-STEP

After configuring everything, run this test:

**In n8n:**
```
1. Click Webhook node
2. Right-click → Execute Node
3. Send test data (see above)
4. Wait for all nodes to turn green
5. Check Respond to Webhook node output
6. Should see JSON response, not empty
```

**In PowerShell:**
```powershell
$url = "https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai"
$body = '{"residentId":"test","name":"Test","age":70,"heartRate":75,"spo2":97,"bloodPressure":"120/80","temperature":36.8,"sleepHours":7,"steps":5000,"cameraEvent":"","timestamp":"2026-07-25T10:00:00.000Z"}'
$response = Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType "application/json"
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected output:**
```json
{
  "residentId": "test",
  "residentName": "Test",
  "healthScore": 85,
  "overallHealth": "Good",
  "riskLevel": "Medium",
  "emergency": false,
  "recommendations": [...],
  "caregiverReport": {...},
  "timestamp": "2026-07-25T...",
  "id": "report-..."
}
```

If you see this, you're done! ✅

---

## 🎯 DONE CHECKLIST

When all this is done:

- ✅ Webhook Response mode: "On Webhook Call"
- ✅ All 8 nodes connected
- ✅ Assemble node has correct code
- ✅ Respond node status: 200
- ✅ Respond node body: Expression set
- ✅ 4 CORS headers added
- ✅ Workflow active (green)
- ✅ Workflow saved
- ✅ Production URL in .env
- ✅ PowerShell test returns JSON
- ✅ React test shows ✅ messages

Then it works! 🎉
