// Component-based architecture for DNS Generator

// --- Components ---
const LocationComponent = {
  render: (location) => {
    const li = document.createElement('li');
    li.className = 'location-item';
    li.setAttribute('data-id', location.id);

    // Create flag span
    const flagSpan = document.createElement('span');
    flagSpan.className = `flag-icon flag-icon-${location.flag}`;
    li.appendChild(flagSpan);

    // Add location name with special formatting for non-city
    if (location.isCity === false) {
      // Get the base name (without "non-city")
      const baseName = location.name.replace(' non-city', '');
      li.innerHTML = `${flagSpan.outerHTML} ${baseName} <span class="non-city-text">(non-city)</span>`;
    } else {
      li.innerHTML = `${flagSpan.outerHTML} ${location.name}`;
    }

    return li;
  }
};

const DNSItemComponent = {
  render: (ip, type, locationData = null) => {
    const dnsItem = document.createElement('div');
    dnsItem.className = 'dns-item loading';

    const countryInfo = locationData ? 
      `<div class="country">${locationData.country_name || 'Unknown'}</div>` : 
      `<div class="loader"></div>`;

    dnsItem.innerHTML = `
      <div class="dns-info">
        <span class="dns-address">${ip}</span>
        <div class="location-info">
          ${countryInfo}
        </div>
      </div>
      <button class="copy-btn" data-ip="${ip}">
        <i class="far fa-copy"></i> Copy
      </button>
    `;
    return dnsItem;
  },

  update: (dnsItem, locationData) => {
    const locationInfo = dnsItem.querySelector('.location-info');
    locationInfo.innerHTML = `
      <div class="country">${locationData.country_name || 'Unknown'}</div>
    `;
    dnsItem.classList.remove('loading');
  }
};

// --- Services ---
const LocationService = {
  locations: [],
  selectedLocation: null,

  async loadLocations() {
    try {
      const response = await fetch('locations.json');
      if (!response.ok) {
        throw new Error('Failed to load locations data');
      }
      this.locations = await response.json();
      return this.locations;
    } catch (error) {
      console.error('Error loading locations:', error);
      // Use fallback locations if there's an error
      this.locations = this.getFallbackLocations();
      return this.locations;
    }
  },

  getFallbackLocations() {
    return [
      {
        id: 'de-frankfurt',
        name: 'Germany (Frankfurt)',
        flag: 'de',
        cidr: '10.0.0.0/16',
        cidrv6: '2001:db8:1::/48',
        available: 65534,
        availableV6: 1208925819614629174706176
      },
      {
        id: 'ae-dubai',
        name: 'UAE (Dubai)',
        flag: 'ae',
        cidr: '10.1.0.0/16',
        cidrv6: '2001:db8:2::/48',
        available: 65534,
        availableV6: 1208925819614629174706176
      },
      {
        id: 'gb-london',
        name: 'UK (London)',
        flag: 'gb',
        cidr: '10.2.0.0/16',
        cidrv6: '2001:db8:3::/48',
        available: 65534,
        availableV6: 1208925819614629174706176
      }
    ];
  },

  getRandomLocation() {
    const randomIndex = Math.floor(Math.random() * this.locations.length);
    return this.locations[randomIndex];
  },

  selectLocation(location) {
    this.selectedLocation = location;
    return location;
  },

  calculateRangeDetails(cidr) {
    // Parse CIDR
    const [baseIP, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength);

    // Calculate total available IPs based on prefix length
    let totalIPs = Math.pow(2, 32 - prefix);

    // Subtract network and broadcast addresses for IPv4
    if (totalIPs > 2) {
      totalIPs -= 2;
    }

    return {
      totalIPs,
      baseIP,
      prefix
    };
  }
};

const DNSGeneratorService = {
  // Generate random IPv4 from CIDR
  generateIPv4FromCIDR(cidrRange) {
    // If cidrRange is an array, select one randomly
    let cidr = cidrRange;
    if (Array.isArray(cidrRange)) {
      cidr = cidrRange[Math.floor(Math.random() * cidrRange.length)];
    }

    // Make sure we have a valid CIDR format (IP/prefix)
    if (!cidr || !cidr.includes('/')) {
      console.error('Invalid CIDR format:', cidr);
      return '0.0.0.0';
    }

    const [baseIP, prefixLength] = cidr.split('/');
    const baseIPArr = baseIP.split('.').map(Number);
    const subnet = 32 - parseInt(prefixLength);

    // Calculate how many octets we can randomly generate
    const randomOctets = Math.floor(subnet / 8);
    const partialOctetBits = subnet % 8;

    // Copy the base IP
    const newIP = [...baseIPArr];

    // Randomize the appropriate octets
    for (let i = 4 - randomOctets; i < 4; i++) {
      newIP[i] = Math.floor(Math.random() * 256);
    }

    // Handle partial octet if needed
    if (partialOctetBits > 0) {
      const octetIndex = 4 - randomOctets - 1;
      const maxValue = Math.pow(2, partialOctetBits) - 1;
      const baseValue = newIP[octetIndex] & (255 - maxValue);
      const randomValue = Math.floor(Math.random() * (maxValue + 1));
      newIP[octetIndex] = baseValue | randomValue;
    }

    // Avoid network and broadcast addresses
    if (newIP[3] === 0 || newIP[3] === 255) {
      newIP[3] = 1 + Math.floor(Math.random() * 254);
    }

    return newIP.join('.');
  },

  // Generate random IPv6 from CIDR
  generateIPv6FromCIDR(cidrRange) {
    // If cidrRange is an array, select one randomly
    let cidr = cidrRange;
    if (Array.isArray(cidrRange)) {
      cidr = cidrRange[Math.floor(Math.random() * cidrRange.length)];
    }

    // Make sure we have a valid CIDR format (IP/prefix)
    if (!cidr || !cidr.includes('/')) {
      console.error('Invalid IPv6 CIDR format:', cidr);
      return '2001:db8::1';
    }

    const [baseIP, prefixLength] = cidr.split('/');
    const prefixLengthNum = parseInt(prefixLength);

    // Parse the base IPv6 address
    let segments = baseIP.split(':');

    // Expand the IPv6 address (replace :: with appropriate number of 0s)
    if (baseIP.includes('::')) {
      const parts = baseIP.split('::');
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      const zeros = Array(missing).fill('0');
      segments = [...left, ...zeros, ...right];
    }

    // Ensure we have 8 segments
    while (segments.length < 8) {
      segments.push('0');
    }

    // Convert segments to numbers (base 16)
    const baseSegments = segments.map(seg => seg ? parseInt(seg, 16) : 0);

    // Determine which segments can be randomized based on prefix length
    const randomizableSegments = Math.floor((128 - prefixLengthNum) / 16);
    const partialSegmentBits = (128 - prefixLengthNum) % 16;

    // Copy the base segments
    const newSegments = [...baseSegments];

    // Randomize the appropriate segments
    for (let i = 8 - randomizableSegments; i < 8; i++) {
      newSegments[i] = Math.floor(Math.random() * 65536); // 16 bits = 0-65535
    }

    // Handle partial segment if needed
    if (partialSegmentBits > 0) {
      const segmentIndex = 8 - randomizableSegments - 1;
      const maxValue = Math.pow(2, partialSegmentBits) - 1;
      const baseValue = newSegments[segmentIndex] & (65535 - maxValue);
      const randomValue = Math.floor(Math.random() * (maxValue + 1));
      newSegments[segmentIndex] = baseValue | randomValue;
    }

    // Convert to hexadecimal representation
    return newSegments.map(n => n.toString(16)).join(':');
  }
};

const APIService = {
  // Fetch IP location data - simplified to get only country name
  async getIPLocationData(ip) {
    try {
      // Add a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://api.iplocation.net/?ip=${ip}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return { country_name: 'Unknown' };
      }
      
      const data = await response.json();
      return { country_name: data && data.country_name ? data.country_name : 'Unknown' };
    } catch (error) {
      console.error('Error fetching IP location:', error);
      return { country_name: 'Unknown' };
    }
  }
};

// --- UI Controllers ---
const UIController = {
  // DOM Elements
  elements: {
    locationList: document.getElementById('location-list'),
    currentLocation: document.getElementById('current-location'),
    currentCIDR: document.getElementById('current-cidr'),
    availableIPs: document.getElementById('available-ips'),
    dnsList: document.getElementById('dns-list'),
    generateIPv4Btn: document.getElementById('generate-ipv4-btn'),
    generateIPv6Btn: document.getElementById('generate-ipv6-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    randomLocationBtn: document.getElementById('random-location-btn')
  },

  // Initialize UI components
  init() {
    this.setupEventListeners();
    this.checkThemePreference();
  },

  // Populate location list
  populateLocations(locations) {
    const fragment = document.createDocumentFragment();
    locations.forEach(location => {
      const li = LocationComponent.render(location);
      li.addEventListener('click', () => {
        this.handleLocationSelect(location);
      });
      fragment.appendChild(li);
    });
    this.elements.locationList.appendChild(fragment);
  },

  // Set up event listeners
  setupEventListeners() {
    this.elements.generateIPv4Btn.addEventListener('click', () => {
      App.handleGenerateIPv4();
    });

    this.elements.generateIPv6Btn.addEventListener('click', () => {
      App.handleGenerateIPv6();
    });

    // Theme toggle
    this.elements.themeToggle.addEventListener('click', this.toggleTheme);

    // Random location selector
    if (this.elements.randomLocationBtn) {
      this.elements.randomLocationBtn.addEventListener('click', () => {
        App.handleRandomLocation();
      });
    }
  },

  // Display location selection
  handleLocationSelect(location) {
    if (!location) {
      console.error("No location selected");
      return;
    }

    try {
      // Make sure we update the selected location in the LocationService
      LocationService.selectLocation(location);
      
      // Generate proper available IPs count based on all CIDRs
      let totalIPv4Count = 0; // Start with 0

      // Calculate total IPs from all IPv4 ranges
      if (location.ranges && location.ranges.ipv4 && Array.isArray(location.ranges.ipv4)) {
        location.ranges.ipv4.forEach(cidr => {
          if (cidr && cidr.includes('/')) {
            try {
              const rangev4 = LocationService.calculateRangeDetails(cidr);
              if (rangev4 && !isNaN(rangev4.totalIPs)) {
                totalIPv4Count += rangev4.totalIPs;
              }
            } catch (e) {
              console.warn("Error calculating range for CIDR:", cidr, e);
            }
          }
        });
      } else if (location.cidr) {
        // Backwards compatibility for old format
        try {
          const rangev4 = LocationService.calculateRangeDetails(location.cidr);
          if (rangev4 && !isNaN(rangev4.totalIPs)) {
            totalIPv4Count = rangev4.totalIPs;
          }
        } catch (e) {
          console.warn("Error calculating range for CIDR:", location.cidr, e);
        }
      }

      // If no ranges were calculated, use a default value
      if (totalIPv4Count === 0) {
        totalIPv4Count = 65534;
      }

      // Ensure we have a valid number for formatting
      const availableIps = isNaN(totalIPv4Count) ? "65,534" : totalIPv4Count.toLocaleString();

      // Calculate estimated IPv6 count (simplified)
      const ipv6Count = 1208925819614629174706176; // Large default value for display

      // Update active class with animation
      document.querySelectorAll('.location-item').forEach(item => {
        item.classList.remove('active');
        item.style.transition = 'all 0.3s ease';
      });

      const selectedItem = document.querySelector(`.location-item[data-id="${location.id}"]`);
      if (selectedItem) {
        selectedItem.classList.add('active');
      }

      // Animate info panel update
      const infoCard = document.querySelector('.info-card');
      if (infoCard) {
        infoCard.style.opacity = '0';
        infoCard.style.transform = 'translateY(10px)';

        setTimeout(() => {
          // Check if elements exist before updating
          if (this.elements.currentLocation) {
            this.elements.currentLocation.textContent = location.name;
          }

          if (this.elements.currentCIDR) {
            // Actually show some CIDR information
            const cidrs = location.ranges && location.ranges.ipv4 ? 
              location.ranges.ipv4.slice(0, 2).join(', ') + (location.ranges.ipv4.length > 2 ? '...' : '') : 
              (location.cidr || '••••••••••••');
            this.elements.currentCIDR.textContent = cidrs;
          }

          if (this.elements.availableIPs) {
            this.elements.availableIPs.textContent = `IPv4: ${availableIps} / IPv6: ${this.formatLargeNumber(ipv6Count)}`;
          }

          // Show info panel with animation
          infoCard.style.opacity = '1';
          infoCard.style.transform = 'translateY(0)';
        }, 300);
      }
    } catch (error) {
      console.error("Error in handleLocationSelect:", error);
    }
  },

  // Toggle between light and dark theme
  toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const themeIcon = document.getElementById('theme-icon');

    if (document.body.classList.contains('dark-theme')) {
      localStorage.setItem('theme', 'dark');
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
    } else {
      localStorage.setItem('theme', 'light');
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
    }
  },

  // Check for saved theme preference
  checkThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark theme
    const themeIcon = document.getElementById('theme-icon');
    
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      if (themeIcon) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
      }
    }
    
    // Save the default theme if not already set
    if (!localStorage.getItem('theme')) {
      localStorage.setItem('theme', 'dark');
    }
  },

  // Format very large numbers with abbreviations
  formatLargeNumber(num) {
    if (!num || isNaN(num)) return '1.2Y'; // مقدار پیش‌فرض برای IPv6

    if (num >= 1e24) return (num / 1e24).toFixed(1) + 'Y'; // yotta
    if (num >= 1e21) return (num / 1e21).toFixed(1) + 'Z'; // zetta
    if (num >= 1e18) return (num / 1e18).toFixed(1) + 'E'; // exa
    if (num >= 1e15) return (num / 1e15).toFixed(1) + 'P'; // peta
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T'; // tera
    return num.toLocaleString();
  },

  // Display generated DNS addresses
  displayDNSAddresses(ips, type) {
    try {
      const dnsList = document.getElementById('dns-list');
      if (!dnsList) {
        console.error('DNS list element not found');
        return;
      }

      // Clear existing content
      dnsList.innerHTML = '';

      const fragment = document.createDocumentFragment();

      // Make sure ips is a valid array
      if (Array.isArray(ips) && ips.length > 0) {
        ips.forEach(ip => {
          const dnsItem = DNSItemComponent.render(ip, type);
          fragment.appendChild(dnsItem);
        });
      } else {
        // If no addresses, show appropriate message
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <i class="fas fa-server"></i>
          <p>No DNS addresses generated</p>
        `;
        fragment.appendChild(emptyState);
      }

      dnsList.appendChild(fragment);
      this.addCopyFunctionality();
      this.animateItems();

    // For IPv4, fetch location data
    if (type === 'IPv4') {
      ips.forEach(async (ip, index) => {
        try {
          const locationData = await APIService.getIPLocationData(ip);
          const dnsList = document.getElementById('dns-list');
          if (dnsList && dnsList.children[index]) {
            DNSItemComponent.update(dnsList.children[index], locationData);
          }
        } catch (error) {
          console.error("Error updating DNS item:", error);
        }
      });
    } else {
      // For IPv6, use selected location data
      const location = LocationService.selectedLocation;
      setTimeout(() => {
        if (!location) return;

        try {
          const dnsList = document.getElementById('dns-list');
          if (!dnsList) return;
          
          const dnsItems = dnsList.querySelectorAll('.dns-item');
          const countryName = location.name ? location.name.split(' (')[0] : 'Unknown';

          dnsItems.forEach(item => {
            const locationInfo = item.querySelector('.location-info');
            if (locationInfo) {
              locationInfo.innerHTML = `
                <div class="country">${countryName}</div>
              `;
              item.classList.remove('loading');
            }
          });
        } catch (error) {
          console.error("Error updating IPv6 location info:", error);
        }
      }, 500);
    }
    } catch (error) {
      console.error("Error displaying DNS addresses:", error);
    }
  },

  // Add copy functionality to buttons
  addCopyFunctionality() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (RateLimitController.checkRateLimit('copy')) return;

        const ip = e.currentTarget.getAttribute('data-ip');

        // Use the Clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = ip;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          if (successful) {
            const originalText = e.currentTarget.innerHTML;
            e.currentTarget.innerHTML = '<i class="fas fa-check"></i> Copied';
            e.currentTarget.classList.add('copied');

            // Add pulse animation
            const dnsItem = e.currentTarget.closest('.dns-item');
            dnsItem.classList.add('pulse-animation');

            setTimeout(() => {
              e.currentTarget.innerHTML = originalText;
              e.currentTarget.classList.remove('copied');
              dnsItem.classList.remove('pulse-animation');
            }, 1500);
          }
        } catch (err) {
          console.error('Failed to copy text: ', err);
        }

        document.body.removeChild(textArea);
      });
    });
  },

  // Add animations for DNS items
  animateItems() {
    document.querySelectorAll('.dns-item').forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';
      setTimeout(() => {
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, index * 100);
    });
  }
};

// Rate limiting controller
const RateLimitController = {
  buttonClickCounter: {
    ipv4: { count: 0, lastClick: 0, blocked: false },
    ipv6: { count: 0, lastClick: 0, blocked: false },
    copy: { count: 0, lastClick: 0, blocked: false }
  },

  checkRateLimit(buttonType) {
    const now = Date.now();
    const button = this.buttonClickCounter[buttonType];

    // Reset counter if it's been more than 3 seconds since last click
    if (now - button.lastClick > 3000) {
      button.count = 1;
      button.lastClick = now;
      return false;
    }

    // Increment counter
    button.count++;
    button.lastClick = now;

    // Check if rate limit reached (5 clicks)
    if (button.count >= 5 && !button.blocked) {
      button.blocked = true;
      this.showRateLimitAlert(buttonType);

      // Unblock after 10 seconds
      setTimeout(() => {
        button.blocked = false;
        button.count = 0;
        this.hideRateLimitAlert();
      }, 10000);

      return true;
    }

    return button.blocked;
  },

  showRateLimitAlert(buttonType) {
    // Create alert if it doesn't exist
    if (!document.getElementById('rate-limit-alert')) {
      const alert = document.createElement('div');
      alert.id = 'rate-limit-alert';
      alert.className = 'rate-limit-alert';

      alert.innerHTML = `
        <div class="alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="alert-message">
          <strong>Slow down!</strong>
          <p>Too many clicks detected. Please wait 10 seconds.</p>
          <div class="alert-timer"><span id="alert-countdown">10</span>s</div>
        </div>
        <button id="alert-close"><i class="fas fa-times"></i></button>
      `;

      document.body.appendChild(alert);

      // Add close button functionality
      document.getElementById('alert-close').addEventListener('click', this.hideRateLimitAlert);

      // Start countdown
      let countdown = 10;
      const countdownEl = document.getElementById('alert-countdown');
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        if (countdown <= 0) clearInterval(countdownInterval);
      }, 1000);

      // Play alert sound
      const alertSound = new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2ooVFYAQWMiiBxqCf/AACGDfFlgCJBmA5cFJYIEohkOBYwCmAUtnEUmCp1KhpJHIA8wSWAAw9P9fpfVP3Pd/57//e//7////t/9/7/////u/t////3/////98sH+AQ==");
      alertSound.play();

      // Show alert with animation
      setTimeout(() => {
        alert.classList.add('show');
      }, 10);
    }
  },

  hideRateLimitAlert() {
    const alert = document.getElementById('rate-limit-alert');
    if (alert) {
      alert.classList.remove('show');
      setTimeout(() => {
        if (alert.parentNode) {
          alert.parentNode.removeChild(alert);
        }
      }, 300);
    }
  }
};

// Main Application
const App = {
  async init() {
    try {
      // Initialize UI before loading locations
      UIController.init();
      
      // Load locations with retries if needed
      let locations = [];
      try {
        locations = await LocationService.loadLocations();
      } catch (error) {
        console.error("Error loading locations, using fallback:", error);
        locations = LocationService.getFallbackLocations();
      }
      
      // Make sure we have the location list element
      const locationList = document.getElementById('location-list');
      if (locationList) {
        UIController.populateLocations(locations);
      } else {
        console.error("Location list element not found");
      }

      // Set a random location after a short delay to ensure DOM is ready
      setTimeout(() => {
        this.handleRandomLocation();
      }, 100);
    } catch (error) {
      console.error("Error initializing app:", error);
      // Still try to show something even if there's an error
      const locations = LocationService.getFallbackLocations();
      UIController.populateLocations(locations);
    }
  },

  handleLocationSelect(location) {
    UIController.handleLocationSelect(location);
  },

  handleRandomLocation() {
    const randomLocation = LocationService.getRandomLocation();
    this.handleLocationSelect(randomLocation);
  },

  async handleGenerateIPv4() {
    if (RateLimitController.checkRateLimit('ipv4')) return;

    if (!LocationService.selectedLocation) {
      alert('Please select a location first');
      return;
    }

    try {
      // Always generate 5 addresses
      const count = 5;
      const ips = [];

      const location = LocationService.selectedLocation;
      const ipv4Ranges = location.ranges && location.ranges.ipv4 ? location.ranges.ipv4 : (location.cidr ? [location.cidr] : []);

      if (!ipv4Ranges.length) {
        console.error("No IPv4 ranges found for location:", location.name);
        ips.push("10.0.0.1"); // Fallback IP if no ranges available
      } else {
        for (let i = 0; i < count; i++) {
          const ip = DNSGeneratorService.generateIPv4FromCIDR(ipv4Ranges);
          ips.push(ip);
          console.log(`Generated IPv4 for ${location.name}:`, ip);
        }
      }

      UIController.displayDNSAddresses(ips, 'IPv4');
    } catch (error) {
      console.error("Error generating IPv4 addresses:", error);
    }
  },

  async handleGenerateIPv6() {
    if (RateLimitController.checkRateLimit('ipv6')) return;

    if (!LocationService.selectedLocation) {
      alert('Please select a location first');
      return;
    }

    try {
      // Always generate 5 addresses
      const count = 5;
      const ips = [];

      const location = LocationService.selectedLocation;
      const ipv6Ranges = location.ranges && location.ranges.ipv6 ? location.ranges.ipv6 : (location.cidrv6 ? [location.cidrv6] : []);

      if (!ipv6Ranges.length) {
        console.error("No IPv6 ranges found for location:", location.name);
        ips.push("2001:db8::1"); // Fallback IPv6 if no ranges available
      } else {
        for (let i = 0; i < count; i++) {
          const ip = DNSGeneratorService.generateIPv6FromCIDR(ipv6Ranges);
          ips.push(ip);
          console.log(`Generated IPv6 for ${location.name}:`, ip);
        }
      }

      UIController.displayDNSAddresses(ips, 'IPv6');
    } catch (error) {
      console.error("Error generating IPv6 addresses:", error);
    }
  }
};

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});