/**
 * PRODUCT POPUP - Main JavaScript Module
 * 
 * Purpose: Handle product popup modal with variant selection and cart functionality
 * 
 * Features:
 * - Fetch product data dynamically via Shopify AJAX API
 * - Render product details (name, price, description, image)
 * - Color variant buttons (background changes to actual color when selected)
 * - Size dropdown (XS, S, M, L, XL)
 * - Add to Cart with validation
 * - Special Logic: Black + Medium → Auto-add "dark-winter-jacket"
 * - Notification system (green success / red error)
 * - Keyboard accessible (ESC to close)
 * 
 * Author: Candidate Assignment
 * Date: 2026-01-03
 */

(function() {
  'use strict';

  // ============================================
  // COLOR MAPPING
  // WHY: Maps variant color names to hex codes for button styling
  // ============================================
  const COLOR_MAP = {
    'black': '#000000',
    'white': '#FFFFFF',
    'blue': '#0D499F',
    'red': '#B20F36',
    'gray': '#AFAFB7',
    'grey': '#AFAFB7',
    'yellow': '#FFF544'
  };

  // Fixed size options as per requirements
  const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'];

  // Global state
  let currentProduct = null;
  let selectedColor = null;
  let selectedSize = null;
  let modalElement = null;

  // ============================================
  // INITIALIZE POPUP
  // WHY: Creates modal DOM on page load for better performance
  // ============================================
  function initializePopup() {
    if (modalElement) return; // Already initialized

    // Create modal HTML structure
    const modalHTML = `
      <div class="product-popup-overlay" id="productPopupOverlay" role="dialog" aria-modal="true" aria-labelledby="popupProductTitle">
        <div class="product-popup-modal">
          <button class="product-popup-close" aria-label="Close popup" type="button">
            <span>&times;</span>
          </button>

          <div class="product-popup-content">
            <div class="product-popup-image-wrapper">
              <img src="" alt="" class="product-popup-image" id="popupProductImage">
            </div>

            <div class="product-popup-details">
              <h3 class="product-popup-title" id="popupProductTitle"></h3>
              <div class="product-popup-price" id="popupProductPrice"></div>
              <div class="product-popup-description" id="popupProductDescription"></div>

              <div class="product-popup-variants">
                <div class="product-popup-colors">
                  <label class="product-popup-label">Color</label>
                  <div class="product-popup-color-buttons" id="popupColorButtons"></div>
                </div>

                <div class="product-popup-sizes">
                  <label class="product-popup-label">Size</label>
                  <select class="product-popup-size-select" id="popupSizeSelect">
                    <option value="">Choose your size</option>
                  </select>
                </div>
              </div>

              <button class="product-popup-add-to-cart" id="popupAddToCart" type="button">
                <span class="btn-text">ADD TO CART</span>
                <span class="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inject modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modalElement = document.getElementById('productPopupOverlay');

    // Attach event listeners
    attachModalEventListeners();

    console.log('Product popup initialized');
  }

  // ============================================
  // ATTACH EVENT LISTENERS
  // ============================================
  function attachModalEventListeners() {
    // Close button
    const closeBtn = modalElement.querySelector('.product-popup-close');
    closeBtn.addEventListener('click', closePopup);

    // Close on overlay click (outside modal)
    modalElement.addEventListener('click', function(e) {
      if (e.target === modalElement) {
        closePopup();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modalElement.classList.contains('active')) {
        closePopup();
      }
    });

    // Add to cart button
    const addToCartBtn = document.getElementById('popupAddToCart');
    addToCartBtn.addEventListener('click', handleAddToCart);

    // Size select change
    const sizeSelect = document.getElementById('popupSizeSelect');
    sizeSelect.addEventListener('change', function() {
      selectedSize = this.value;
      updateAddToCartButton();
    });
  }

  // ============================================
  // OPEN POPUP - Main entry point
  // WHY: Exposed to global scope for section script to call
  // ============================================
  window.openProductPopup = function(productHandle) {
    if (!modalElement) {
      initializePopup();
    }

    // Fetch product data from Shopify
    fetchProductData(productHandle)
      .then(function(product) {
        currentProduct = product;
        renderPopupContent(product);
        showPopup();
      })
      .catch(function(error) {
        console.error('Error fetching product:', error);
        showNotification('Failed to load product. Please try again.', 'error');
      });
  };

  // ============================================
  // FETCH PRODUCT DATA
  // WHY: Uses Shopify's built-in AJAX API for product data
  // ============================================
  function fetchProductData(handle) {
    return fetch(`/products/${handle}.js`)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Product not found');
        }
        return response.json();
      });
  }

  // ============================================
  // RENDER POPUP CONTENT
  // WHY: Dynamically populates modal with product data
  // ============================================
  function renderPopupContent(product) {
    // Reset selections
    selectedColor = null;
    selectedSize = null;

    // Set product image
    const imageEl = document.getElementById('popupProductImage');
    if (product.featured_image) {
      imageEl.src = product.featured_image;
      imageEl.alt = product.title;
    }

    // Set product title
    document.getElementById('popupProductTitle').textContent = product.title;

    // Set product price
    const priceEl = document.getElementById('popupProductPrice');
    priceEl.textContent = formatPrice(product.price);

    // Set product description
    const descEl = document.getElementById('popupProductDescription');
    descEl.textContent = stripHtml(product.description);

    // Render color variants
    renderColorVariants(product);

    // Populate size dropdown
    populateSizeDropdown();

    // Update add to cart button state
    updateAddToCartButton();
  }

  // ============================================
  // RENDER COLOR VARIANTS
  // WHY: Extracts unique colors from variants and creates buttons
  // ============================================
  function renderColorVariants(product) {
    const colorButtonsContainer = document.getElementById('popupColorButtons');
    colorButtonsContainer.innerHTML = '';

    // Extract unique colors from variants (option1 is typically color)
    const colors = new Set();
    product.variants.forEach(function(variant) {
      if (variant.option1) {
        colors.add(variant.option1);
      }
    });

    // Create button for each color
    colors.forEach(function(color) {
      const button = document.createElement('button');
      button.className = 'product-popup-color-btn';
      button.textContent = color;
      button.setAttribute('data-color', color);
      button.type = 'button';

      // Attach click handler
      button.addEventListener('click', function() {
        selectColor(color, button);
      });

      colorButtonsContainer.appendChild(button);
    });
  }

  // ============================================
  // SELECT COLOR
  // WHY: Updates selected color and button styling
  // Special requirement: Button background becomes the actual color
  // ============================================
  function selectColor(color, buttonElement) {
    selectedColor = color;

    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.product-popup-color-btn');
    allButtons.forEach(function(btn) {
      btn.classList.remove('active');
      btn.style.backgroundColor = '';
      btn.style.color = '';
    });

    // Add active class and apply color styling
    buttonElement.classList.add('active');
    
    const colorKey = color.toLowerCase();
    const hexColor = COLOR_MAP[colorKey] || '#000000';
    
    buttonElement.style.backgroundColor = hexColor;
    
    // WHY: White text on white background is unreadable, use black instead
    if (colorKey === 'white') {
      buttonElement.style.color = '#000000';
    } else {
      buttonElement.style.color = '#FFFFFF';
    }

    // Update add to cart button state
    updateAddToCartButton();
  }

  // ============================================
  // POPULATE SIZE DROPDOWN
  // WHY: Fixed size options as per requirements (XS, S, M, L, XL)
  // ============================================
  function populateSizeDropdown() {
    const sizeSelect = document.getElementById('popupSizeSelect');
    
    // Clear existing options except first one
    sizeSelect.innerHTML = '<option value="">Choose your size</option>';

    // Add fixed size options
    SIZE_OPTIONS.forEach(function(size) {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      sizeSelect.appendChild(option);
    });
  }

  // ============================================
  // UPDATE ADD TO CART BUTTON
  // WHY: Enables/disables button based on selection state
  // ============================================
  function updateAddToCartButton() {
    const addToCartBtn = document.getElementById('popupAddToCart');
    
    if (selectedColor && selectedSize) {
      addToCartBtn.disabled = false;
      addToCartBtn.classList.remove('disabled');
    } else {
      addToCartBtn.disabled = true;
      addToCartBtn.classList.add('disabled');
    }
  }

  // ============================================
  // HANDLE ADD TO CART
  // WHY: Main cart logic with validation and special Black+Medium rule
  // ============================================
  function handleAddToCart() {
    // Validation
    if (!selectedColor || !selectedSize) {
      showNotification('Please select both color and size', 'error');
      return;
    }

    // Find matching variant
    const variant = findMatchingVariant(currentProduct, selectedColor, selectedSize);

    if (!variant) {
      showNotification('This combination is not available', 'error');
      return;
    }

    // Disable button during cart operation
    const addToCartBtn = document.getElementById('popupAddToCart');
    addToCartBtn.disabled = true;
    addToCartBtn.querySelector('.btn-text').textContent = 'ADDING...';

    // Add primary product to cart
    addToCart(variant.id)
      .then(function() {
        // Check for special logic: Black + Medium
        if (selectedColor.toLowerCase() === 'black' && selectedSize === 'M') {
          return autoAddSoftWinterJacket();
        }
      })
      .then(function() {
        showNotification('Added to cart', 'success');
        
        // Update cart count if theme has cart icon
        updateCartCount();

        // Close popup after short delay
        setTimeout(function() {
          closePopup();
        }, 1000);
      })
      .catch(function(error) {
        console.error('Add to cart error:', error);
        showNotification('A problem happened. Error: ' + error.message, 'error');
      })
      .finally(function() {
        // Re-enable button
        addToCartBtn.disabled = false;
        addToCartBtn.querySelector('.btn-text').textContent = 'ADD TO CART';
      });
  }

  // ============================================
  // FIND MATCHING VARIANT
  // WHY: Matches selected color and size to product variant
  // ============================================
  function findMatchingVariant(product, color, size) {
    return product.variants.find(function(variant) {
      // option1 is typically color, option2 is typically size
      const variantColor = variant.option1 ? variant.option1.toLowerCase() : '';
      const variantSize = variant.option2 ? variant.option2.toUpperCase() : '';
      
      return variantColor === color.toLowerCase() && variantSize === size;
    });
  }

  // ============================================
  // ADD TO CART - Shopify AJAX API
  // WHY: Uses Shopify's built-in cart API for reliability
  // ============================================
  function addToCart(variantId, quantity) {
    quantity = quantity || 1;

    return fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        id: variantId,
        quantity: quantity
      })
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }
      return response.json();
    });
  }

  // ============================================
  // AUTO-ADD SOFT WINTER JACKET
  // WHY: Special requirement - when Black + Medium selected
  // Product handle: "dark-winter-jacket"
  // ============================================
  function autoAddSoftWinterJacket() {
    console.log('Special logic triggered: Adding Soft Winter Jacket');

    return fetch('/products/dark-winter-jacket.js')
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Soft Winter Jacket product not found');
        }
        return response.json();
      })
      .then(function(jacket) {
        // Get first available variant (or default)
        const variantId = jacket.variants[0].id;
        
        return addToCart(variantId, 1);
      })
      .catch(function(error) {
        // Log error but don't block main cart add
        console.error('Failed to auto-add Soft Winter Jacket:', error);
        // Don't show error to user - silently fail as per best practices
      });
  }

  // ============================================
  // UPDATE CART COUNT
  // WHY: Updates cart icon badge if theme has one
  // ============================================
  function updateCartCount() {
    fetch('/cart.js')
      .then(function(response) {
        return response.json();
      })
      .then(function(cart) {
        const cartCountElements = document.querySelectorAll('.cart-count, [data-cart-count]');
        cartCountElements.forEach(function(el) {
          el.textContent = cart.item_count;
        });

        // Trigger custom event for themes that listen to it
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
      })
      .catch(function(error) {
        console.error('Failed to update cart count:', error);
      });
  }

  // ============================================
  // SHOW NOTIFICATION
  // WHY: User feedback for cart operations
  // Top-right corner as per requirements
  // ============================================
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = 'product-popup-notification product-popup-notification--' + type;
    notification.textContent = message;

    // Apply styles
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '16px 24px';
    notification.style.borderRadius = '4px';
    notification.style.color = '#FFFFFF';
    notification.style.fontWeight = '600';
    notification.style.fontSize = '14px';
    notification.style.zIndex = '10001';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    notification.style.animation = 'slideInFromRight 0.3s ease';

    if (type === 'success') {
      notification.style.backgroundColor = '#10B981'; // Green
    } else {
      notification.style.backgroundColor = '#B20F36'; // Red
    }

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(function() {
      notification.style.animation = 'slideOutToRight 0.3s ease';
      setTimeout(function() {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // ============================================
  // SHOW/HIDE POPUP
  // ============================================
  function showPopup() {
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }

  function closePopup() {
    modalElement.classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
    
    // Reset state
    currentProduct = null;
    selectedColor = null;
    selectedSize = null;
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Format price in Shopify money format
   * WHY: Shopify prices are in cents, need to convert to dollars
   */
  function formatPrice(cents) {
    const dollars = (cents / 100).toFixed(2);
    return '$' + dollars;
  }

  /**
   * Strip HTML tags from description
   * WHY: Product descriptions often contain HTML, we want plain text
   */
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // ============================================
  // INITIALIZE ON DOM READY
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
  } else {
    initializePopup();
  }

  console.log('Product popup script loaded');

})();
