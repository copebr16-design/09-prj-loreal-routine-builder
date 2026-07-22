// ============================================
// L'ORÉAL ROUTINE BUILDER
// ============================================
const WORKER_URL = "https://loreal-chatbot.copebr16.workers.dev";

// DOM Elements
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateBtn = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");
const searchInput = document.getElementById("searchInput");
const langToggle = document.getElementById("langToggle");

// State
let allProducts = [];
let selectedProducts = [];
let conversationHistory = [];

// Placeholder on load
productsContainer.innerHTML = `<div class="placeholder-message">Select a category to view products</div>`;

// ============================================
// LOAD PRODUCTS
// ============================================
async function loadProducts() {
  if (allProducts.length > 0) return allProducts;
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

// ============================================
// DISPLAY PRODUCTS
// ============================================
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products found.</div>`;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some((p) => p.id === product.id);
      return `
      <div class="product-card ${isSelected ? "selected" : ""}" data-id="${product.id}">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p class="brand">${product.brand}</p>
          <button class="desc-toggle" data-id="${product.id}">
            ${isSelected ? "✓ Selected" : "+ Select"}
          </button>
          <div class="product-desc" id="desc-${product.id}" style="display:none;">
            <p>${product.description}</p>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // Card click to select/deselect
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("desc-toggle")) return;
      const id = parseInt(card.dataset.id);
      const product = allProducts.find((p) => p.id === id);
      toggleProduct(product);
      filterAndDisplay();
    });
  });

  // Description toggle button
  document.querySelectorAll(".desc-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const desc = document.getElementById(`desc-${id}`);
      const product = allProducts.find((p) => p.id === parseInt(id));

      if (desc.style.display === "none") {
        desc.style.display = "block";
        btn.textContent = selectedProducts.some((p) => p.id === parseInt(id))
          ? "✓ Selected"
          : "Hide Info";
      } else {
        toggleProduct(product);
        filterAndDisplay();
      }
    });
  });
}

// ============================================
// TOGGLE PRODUCT SELECTION
// ============================================
function toggleProduct(product) {
  const index = selectedProducts.findIndex((p) => p.id === product.id);
  if (index === -1) {
    selectedProducts.push(product);
  } else {
    selectedProducts.splice(index, 1);
  }
  saveSelectedProducts();
  updateSelectedList();
}

// ============================================
// UPDATE SELECTED PRODUCTS LIST
// ============================================
function updateSelectedList() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="no-selection">No products selected yet.</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
    <div class="selected-tag" data-id="${p.id}">
      <span>${p.name}</span>
      <button class="remove-tag" data-id="${p.id}" aria-label="Remove ${p.name}">✕</button>
    </div>
  `,
    )
    .join("");

  document.querySelectorAll(".remove-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id);
      const product = allProducts.find((p) => p.id === id);
      toggleProduct(product);
      filterAndDisplay();
    });
  });
}

// ============================================
// LOCALSTORAGE — SAVE & LOAD
// ============================================
function saveSelectedProducts() {
  localStorage.setItem("lorealSelected", JSON.stringify(selectedProducts));
}

function loadSavedProducts() {
  const saved = localStorage.getItem("lorealSelected");
  if (saved) {
    selectedProducts = JSON.parse(saved);
    updateSelectedList();
  }
}

// Clear all button
document.getElementById("clearAll").addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedList();
  filterAndDisplay();
});

// ============================================
// FILTER AND DISPLAY
// ============================================
async function filterAndDisplay() {
  const products = await loadProducts();
  const category = categoryFilter.value;
  const search = searchInput ? searchInput.value.toLowerCase() : "";

  let filtered = products;
  if (category) filtered = filtered.filter((p) => p.category === category);
  if (search)
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.brand.toLowerCase().includes(search),
    );

  displayProducts(filtered);
}

categoryFilter.addEventListener("change", filterAndDisplay);
searchInput.addEventListener("input", filterAndDisplay);

// ============================================
// ADD MESSAGE TO CHAT
// ============================================
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  div.innerHTML = `<div class="bubble">${text.replace(/\n/g, "<br>")}</div>`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "chat-message assistant typing-indicator";
  div.id = "typing";
  div.innerHTML = `<div class="bubble"><span></span><span></span><span></span></div>`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

// ============================================
// CALL CLOUDFLARE WORKER
// ============================================
async function callWorker(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: messages,
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

// ============================================
// GENERATE ROUTINE
// ============================================
generateBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addMessage("assistant", "Please select at least one product first!");
    return;
  }

  const productSummary = selectedProducts
    .map((p) => `${p.name} by ${p.brand} (${p.category}): ${p.description}`)
    .join("\n\n");

  const systemPrompt = `You are a professional L'Oréal beauty advisor. 
Create personalized skincare, haircare, or beauty routines using only 
the products the user has selected. Be specific about when and how to 
use each product. Keep responses helpful, warm, and on-topic about 
beauty and wellness. Never recommend products outside the L'Oréal family.`;

  const userMessage = `Please create a personalized routine using these products:\n\n${productSummary}`;

  conversationHistory = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  addMessage("user", "Generate my personalized routine!");
  showTyping();
  generateBtn.disabled = true;

  try {
    const reply = await callWorker(conversationHistory);
    conversationHistory.push({ role: "assistant", content: reply });
    removeTyping();
    addMessage("assistant", reply);
  } catch (err) {
    removeTyping();
    addMessage("assistant", "Something went wrong. Please try again.");
    console.error(err);
  }

  generateBtn.disabled = false;
});

// ============================================
// FOLLOW-UP CHAT
// ============================================
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  const userText = input.value.trim();
  if (!userText) return;

  input.value = "";
  addMessage("user", userText);
  showTyping();

  if (conversationHistory.length === 0) {
    conversationHistory.push({
      role: "system",
      content: `You are a professional L'Oréal beauty advisor. 
Help users with skincare, haircare, makeup, and beauty routines. 
Keep answers relevant, warm, and helpful. 
Only discuss beauty, wellness, and L'Oréal-related topics.`,
    });
  }

  conversationHistory.push({ role: "user", content: userText });

  try {
    const reply = await callWorker(conversationHistory);
    conversationHistory.push({ role: "assistant", content: reply });
    removeTyping();
    addMessage("assistant", reply);
  } catch (err) {
    removeTyping();
    addMessage("assistant", "Something went wrong. Please try again.");
    console.error(err);
  }
});

// ============================================
// BONUS: RTL LANGUAGE SUPPORT
// ============================================
langToggle.addEventListener("click", () => {
  const html = document.documentElement;
  if (html.getAttribute("dir") === "rtl") {
    html.setAttribute("dir", "ltr");
    langToggle.textContent = "عربي";
  } else {
    html.setAttribute("dir", "rtl");
    langToggle.textContent = "English";
  }
});

// ============================================
// INIT
// ============================================
loadSavedProducts();
