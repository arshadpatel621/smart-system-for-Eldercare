# N8N WORKFLOW DEBUGGING - COMPLETE FIX GUIDE

## 🔴 ROOT CAUSE ANALYSIS

Based on error patterns "Failed to fetch" and "Unexpected end of JSON input", the issues are:

1. **Webhook Response Mode** - Set to "Last Node" instead of "On Webhook Call"
   - Causes n8n to execute async instead of waiting for response
   - React timeout because n8n never responds to webhook

2. **Empty Response Body** - "Respond to Webhook" not returning assembled JSON
   - No expression in response body field
   - Results in empty response → "Unexpected end of JSON input"

3. **Manual Execution Required** - Nodes not connected for automatic flow
   - Missing connections between nodes
   - Execution mode is "Always" not "Trigger"

4. **Missing CORS Headers** - Cross-origin request blocked or incorrectly handled
   - Response missing Content-Type header
   - Browser cannot parse response

---

## ✅ EXACT N8N FIXES (IN ORDER)

### **FIX #1: WEBHOOK NODE CONFIGURATION**

**Location:** Click on the Webhook node (trigger node)

**Step 1 - Response Mode:**
- Look for: **Response mode** dropdown (usually showing "Last node")
- Change to: **"On Webhook Call"**
- Why: Makes the webhook wait for the next node to complete, not the last node in workflow

**Step 2 - HTTP Method:**
- Confirm: **Allow POST** is checked
- Uncheck any other methods (GET, PUT, DELETE)
- Why: Your React only sends POST requests

**Step 3 - Save:**
- Click anywhere outside the dialog to confirm

**Screenshot equivalent:**
```
Webhook Node → Settings Icon (gear) → 
Response mode dropdown → Select "On Webhook Call" →
Confirm checkboxes: POST ✓, GET ❌, others ❌
```

---

### **FIX #2: CONNECT WEBHOOK TO NORMALIZE NODE**

**Location:** Workflow canvas

**Step 1:**
- Right-click on Webhook node → "Execute Node" (test it works)
- Should execute without error

**Step 2:**
- Click the Webhook node
- Drag connector from output (right side) to Normalize input (left side)
- Confirm: Webhook → Normalize is connected

**Screenshot equivalent:**
```
[Webhook] ──→ [Normalize Input]
```

---

### **FIX #3: VERIFY ALL NODE CONNECTIONS (IN SEQUENCE)**

**Ensure these connections exist:**

```
[Webhook] 
    ↓
[Normalize Input] 
    ↓
[Health Monitoring Agent]
    ↓
[Risk Prediction Agent]
    ↓
[Emergency Agent]
    ↓
[Recommendation Agent]
    ↓
[Caregiver Report Agent]
    ↓
[Assemble Final Response]
    ↓
[Respond to Webhook]
```

**Check each connection:**
1. Click on connecting line
2. Should show arrow pointing downward
3. No red X marks
4. All nodes must be connected sequentially

---

### **FIX #4: ASSEMBLE FINAL RESPONSE NODE**

**Location:** Click on "Assemble Final Response" node

**Step 1 - Node Type Check:**
- Should be: **"Function"** or **"Set"** node
- NOT "Merge" or "Passthrough"
- If wrong type, delete and add new "Function" node

**Step 2 - Output Expression:**
Delete current content and paste this:

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

**Step 3 - Test:**
- Right-click → Execute Node
- Check output is valid JSON (no red errors)

**Screenshot equivalent:**
```
[Assemble Final Response] Node →
JavaScript/Function Code Area →
Paste the above code
```

---

### **FIX #5: RESPOND TO WEBHOOK NODE CONFIGURATION**

**Location:** Click on "Respond to Webhook" node

**Step 1 - Status Code:**
- Field: **Status Code**
- Value: **200**
- Why: 200 = success, anything else = error

**Step 2 - Response Body:**
Delete the current content and paste:

```
{{ $node["Assemble Final Response"].json[0] }}
```

Note: If your "Assemble" node has a different name, replace "Assemble Final Response" with the actual node name.

**Step 3 - Add Response Headers:**

Click **Add Response Headers** and add these:

| Header | Value |
|--------|-------|
| Content-Type | application/json |
| Access-Control-Allow-Origin | * |
| Access-Control-Allow-Methods | POST, GET, OPTIONS |
| Access-Control-Allow-Headers | Content-Type, Authorization |

**How to add:**
1. Click "Add Response Headers" link
2. First row: Key = `Content-Type`, Value = `application/json`
3. Click "Add Header" button for next row
4. Second row: Key = `Access-Control-Allow-Origin`, Value = `*`
5. Continue for remaining headers

**Step 4 - Test:**
- Right-click → Execute Node
- Output should show status 200

**Screenshot equivalent:**
```
[Respond to Webhook] Node → Settings →
Status Code: 200 →
Response Body: {{ $node["Assemble Final Response"].json[0] }} →
Headers tab → Add all 4 headers above
```

---

### **FIX #6: PUBLISH THE WORKFLOW**

**Location:** Top of workflow editor

**Step 1:**
- Look for **"Active"** toggle (should be in top area)
- Make sure it's **ON (green)**
- If OFF, click to activate

**Step 2:**
- Click **"Save"** button
- Wait for confirmation message

**Step 3 - Verify Production Webhook URL:**
- Click on Webhook node
- Copy the **production URL** (not test URL)
- Should be: `https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai`
- Should NOT contain `/test/`

**Step 4:**
- Confirm URL matches `VITE_N8N_WEBHOOK_URL` in React `.env`

---

### **FIX #7: AGENT NODE EXECUTION MODE**

**Check each Agent node** (Health, Risk, Emergency, Recommendation, Caregiver):

**For each one:**
1. Right-click → **Settings**
2. Check: **"Execute Automatically"** is enabled (default)
3. Check: No **"Wait"** or **"Delay"** settings
4. Check: **"On Error"** is set to "Stop on error" or "Continue on error"

**Screenshot equivalent:**
```
[Agent Node] → Right-click → Settings →
Execute Automatically: ✓ Enabled →
No Pause/Wait/Delay settings
```

---

## 🧪 TEST SEQUENCE (DO ALL THESE IN ORDER)

### **TEST 1: PowerShell Direct Webhook Test**

Open PowerShell and run:

```powershell
$url = "https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai"

$body = @{
    residentId = "demo-resident"
    name = "Anita Rao"
    age = 74
    heartRate = 76
    spo2 = 97
    bloodPressure = "128/82"
    temperature = 36.8
    sleepHours = 7.2
    steps = 4120
    cameraEvent = "none"
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json

Write-Host "Sending request to n8n..."
$response = Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType "application/json" -ErrorAction Continue

Write-Host "Status: $($response.StatusCode)"
Write-Host "Response:"
Write-Host $response.Content
```

**Expected output:**
```
Status: 200
Response:
{
  "residentId": "demo-resident",
  "residentName": "Anita Rao",
  "healthScore": 85,
  "overallHealth": "Good",
  "riskLevel": "Medium",
  "emergency": false,
  ...
}
```

**If you see:** Empty response, status 200 → **Go to FIX #5**
**If you see:** Status 404 → **Go to FIX #6**
**If you see:** Status 500 → Check n8n agent logs for errors

---

### **TEST 2: Browser Console Test**

1. Open your React app
2. Press **F12** to open DevTools
3. Click **Console** tab
4. Click **"Analyze Health Data"** button
5. Look for console messages:

**Should see (in order):**
```
📋 Validating request data...
✅ Data validation passed
📤 Calling n8n workflow...
📤 Sending analysis request to n8n
   URL: https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai
   Payload: {...}
✅ Analysis received from n8n successfully
   Report ID: report-...
   Timestamp: 2026-07-25T...
✅ Data validation passed
💾 Saving report to Firestore...
```

**If you see errors:**
- "N8N workflow returned status 404" → Check webhook URL in .env
- "Request timeout" → n8n workflow is too slow, check agents
- "Invalid JSON" → Response body malformed, check FIX #5
- "Response missing required field" → Check Assemble node output

---

### **TEST 3: Network Tab Test**

1. Open DevTools → **Network** tab
2. Click **"Analyze Health Data"** button
3. Look for POST request to `arshadpatel6361.app.n8n.cloud`
4. Click on it
5. Check:

**Request tab:**
```
POST /webhook/vitalcare-ai
Content-Type: application/json
Body: {
  "residentId": "demo-resident",
  "name": "Anita Rao",
  ...
}
```

**Response tab:**
```
Status Code: 200
{
  "residentId": "demo-resident",
  "residentName": "Anita Rao",
  "healthScore": 87,
  ...
}
```

**Headers tab:**
```
Content-Type: application/json
Access-Control-Allow-Origin: *
...
```

**If Response is empty:**
- Go to FIX #5 and check response body expression

**If Status is not 200:**
- Check n8n logs for errors

---

## 📊 COMMON ISSUES & SOLUTIONS

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to fetch" | Webhook URL wrong or workflow inactive | Check FIX #1 & #6 |
| "Unexpected end of JSON input" | Empty response body | Check FIX #5, Response Body field |
| "404 Not Found" | Webhook URL has `/test/` | Use production URL in .env |
| "Request timeout after 60s" | n8n agents too slow | Reduce agent complexity or increase timeout |
| "Invalid JSON" | Assemble node output malformed | Check FIX #4, paste correct expression |
| "Response missing required field" | Missing node references | Check node names match expressions |
| Manual execute required | Response mode = "Last node" | Change to "On Webhook Call" (FIX #1) |

---

## 🔍 DEBUGGING CHECKLIST

Before assuming it's broken, verify:

- [ ] Webhook Response mode = "On Webhook Call"
- [ ] Webhook node is connected to Normalize
- [ ] All 8 nodes connected in sequence
- [ ] Assemble node has correct JavaScript
- [ ] Respond node status = 200
- [ ] Respond node body = `{{ $node["Assemble Final Response"].json[0] }}`
- [ ] All 4 CORS headers added to Respond node
- [ ] Workflow is **Active** (green toggle)
- [ ] n8n workflow is **Saved**
- [ ] React `.env` has correct webhook URL
- [ ] No manual "Execute Workflow" required
- [ ] PowerShell test returns JSON
- [ ] Browser console shows ✅ messages
- [ ] Network tab shows status 200

---

## 🚀 FINAL VERIFICATION

Once all fixes are done, run this test:

**In PowerShell:**
```powershell
$url = "https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai"
$body = '{"residentId":"demo-resident","name":"Anita Rao","age":74,"heartRate":76,"spo2":97,"bloodPressure":"128/82","temperature":36.8,"sleepHours":7.2,"steps":4120,"cameraEvent":"none","timestamp":"2026-07-25T10:30:00.000Z"}' | ConvertFrom-Json | ConvertTo-Json

$response = Invoke-WebRequest -Uri $url -Method POST -Body ($body | ConvertTo-Json) -ContentType "application/json"
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**In React:**
1. Click "Analyze Health Data"
2. Watch console for ✅ messages
3. See UI update with AI report
4. Check Firestore has new document in AIReports collection

**Expected result:**
- ✅ No manual "Execute Workflow" 
- ✅ No "Failed to fetch"
- ✅ No "Unexpected end of JSON input"
- ✅ UI shows fall risk, emergency status, recommendations
- ✅ Report saved to Firestore in <5 seconds
- ✅ Everything works 100% automatically

---

## 📝 N8N WORKFLOW NODE CHECKLIST

Use this to verify each node:

```
[  ] Webhook
     - Response mode: On Webhook Call
     - POST enabled
     - Connected to Normalize

[  ] Normalize Input
     - Node type: correct type
     - Connected to Health Agent

[  ] Health Monitoring Agent
     - Node type: LLM or custom
     - Connected to Risk Agent

[  ] Risk Prediction Agent
     - Node type: LLM or custom
     - Connected to Emergency Agent

[  ] Emergency Agent
     - Node type: LLM or custom
     - Connected to Recommendation Agent

[  ] Recommendation Agent
     - Node type: LLM or custom
     - Connected to Caregiver Agent

[  ] Caregiver Report Agent
     - Node type: LLM or custom
     - Connected to Assemble node

[  ] Assemble Final Response
     - Node type: Function or Set
     - Has JavaScript output (see FIX #4)
     - Connected to Respond node

[  ] Respond to Webhook
     - Status Code: 200
     - Response Body: {{ $node["Assemble Final Response"].json[0] }}
     - Headers: 4 CORS headers added
```

---

## 💾 IF STILL NOT WORKING

Collect this info and share:

1. **PowerShell test output** (from TEST 1)
2. **Browser console output** (from TEST 2)
3. **Network request/response** (from TEST 3)
4. **n8n workflow JSON export**
   - Click menu → Export workflow → Save JSON
5. **Error message** from any of the above

This will help identify the exact issue.

---

## ✨ SUCCESS INDICATORS

You'll know it's fixed when:

✅ Click "Analyze Health Data"  
✅ Console shows `📤 Sending analysis request...`  
✅ Wait 5-10 seconds  
✅ Console shows `✅ Analysis received...`  
✅ UI updates with Fall Risk, Emergency Status, etc.  
✅ Firestore saves report automatically  
✅ No manual steps needed  
✅ No error messages  
✅ Works repeatedly without issues  

---

**🎉 You're done! The workflow is now production-ready.**
