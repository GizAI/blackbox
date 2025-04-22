// Development mode helper script
(function() {
  // Check if we're in development mode
  const isDev = window.location.protocol === 'file:' && 
                window.location.pathname.includes('/src/renderer/');
  
  if (isDev) {
    console.log('Running in development mode');
    
    // Fix CSS path for development mode
    const stylesheet = document.getElementById('main-stylesheet');
    if (stylesheet) {
      const currentHref = stylesheet.getAttribute('href');
      const absolutePath = new URL(currentHref, window.location.href).href;
      console.log('Setting stylesheet path:', absolutePath);
      stylesheet.setAttribute('href', absolutePath);
    }
    
    // Add development mode indicator
    const devIndicator = document.createElement('div');
    devIndicator.style.position = 'fixed';
    devIndicator.style.bottom = '10px';
    devIndicator.style.right = '10px';
    devIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    devIndicator.style.color = 'white';
    devIndicator.style.padding = '5px 10px';
    devIndicator.style.borderRadius = '5px';
    devIndicator.style.fontSize = '12px';
    devIndicator.style.zIndex = '9999';
    devIndicator.textContent = 'DEV MODE';
    
    // Add the indicator to the body when it's ready
    if (document.body) {
      document.body.appendChild(devIndicator);
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(devIndicator);
      });
    }
  }
})();
