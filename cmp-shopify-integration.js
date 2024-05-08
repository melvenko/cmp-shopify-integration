window.Shopify.loadFeatures(
    [
        {
            name: 'consent-tracking-api',
            version: '0.1',
        },
    ],
    error => {
        if (error) {
            // Rescue error
        }
        // If error is false, the API has loaded and ready to use!
    },
);

/**
* This function returns value of notice_behavior cookie to determine location and behavior manager based on domain.
* When no notice_behavior cookie exists, this returns a blank string.
*/
function getBehavior() {
    var result = "";
    var rx = new RegExp("\\s*notice_behavior\\s*=\\s*([^;]*)").exec(document.cookie);
    if(rx&&rx.length>1){
        result = rx[1];
    }
    return result;
}

// This code is responsible for listening to any consent changes trough TrustArc's CCM Instance
// And pushing the consent changes to the dataLayer according to the customer's consent mapping

// This is for the intial load. If the user has a consent different from the default vales, this is to push an update to the datalayer 
// Once the the CCM loads. 
var interval = setInterval(() => {
    if (window.truste && truste.cma && truste.cma.callApi) {
        var consentDecision = truste.cma.callApi("getGDPRConsentDecision", "your_domain.com");
        handleConsentDecision(consentDecision);
        clearInterval(interval);
    }
    console.log("runing...");
}, 100);

// Bucket Mapping
const REQUIRED = 1;
const FUNCTIONAL = 2;
const ADVERTISING = 3;

// Start listning to when users submit their preferences  
window.addEventListener("message", (event) => {
    let eventDataJson = null;

    // We only care about TrustArc Events at this point. And TrustArc's even it encoded in JSON
    try {
        eventDataJson = JSON.parse(event.data);
    } catch {
        // Some other event that is not JSON. 
        // TrustArc encodes the data as JSON
        // console.log(event.data);
    }

    // Safeguard to make sure we are only getting events from TrustArc
    if (eventDataJson && eventDataJson.source === "preference_manager") {

        // Means that the user has submited their preferences
        if (eventDataJson.message === "submit_preferences") {
            console.log("Event Data: ", eventDataJson);

            // Waiting half a second to make sure user's preferences are reflected. 
            setTimeout(() => {
                var consentDecision = truste.cma.callApi("getGDPRConsentDecision", "your_domain.com");
                // console.log("Consent Decision: ", consentDecision);
                handleConsentDecision(consentDecision);
            }, 500);
        }
    }

}, false);

function handleConsentDecision(consent) {

    var functionalAccepted = consent.consentDecision.includes(FUNCTIONAL);
    var advertisingAccepted = consent.consentDecision.includes(ADVERTISING);

    // Check if behavior manager is EU
    // This is optional if you want opt-out experience (opt in by default)
    var isEU = /.*(,|)eu/i.test(getBehavior());
    if(consent.source == 'implied' && !isEU) {
      functionalAccepted = true;
      advertisingAccepted = true;
    }

    const callback = () => { }
    
    //For details see: https://shopify.dev/docs/api/customer-privacy#collect-and-register-consent
    window.Shopify.customerPrivacy.setTrackingConsent(
        {
            "analytics": functionalAccepted,
            "marketing": advertisingAccepted,
            "preferences": functionalAccepted, 
            "sale_of_data": advertisingAccepted,
        },
        callback
    );
    //Use this function to check if the preferences have been set
    //window.Shopify.customerPrivacy.currentVisitorConsent();
}
