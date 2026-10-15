process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const trk = '383772352970';
  console.log('Querying FedEx for tracking:', trk);
  try {
    const url = 'https://www.fedex.com/trackingCal/track';
    const params = new URLSearchParams();
    params.append('data', JSON.stringify({
      TrackPackagesRequest: {
        appType: 'wtrk',
        uniqueKey: '',
        processingParameters: {},
        trackingInfoList: [{
          trackNumberInfo: {
            trackingNumber: trk,
            trackingQualifier: '',
            trackingCarrier: ''
          }
        }]
      }
    }));
    params.append('action', 'trackpackages');
    params.append('locale', 'en_US');
    params.append('version', '1');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: params.toString()
    });

    console.log('FedEx HTTP Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      const pkg = data?.TrackPackagesResponse?.packageList?.[0];
      console.log('Key details:', {
        statusWithDetails: pkg?.statusWithDetails,
        displayEstDeliveryDateTime: pkg?.displayEstDeliveryDateTime,
        displayActDeliveryDateTime: pkg?.displayActDeliveryDateTime,
        recipientAddress: pkg?.recipientAddress,
        deliveryLocation: pkg?.deliveryLocation,
        receivedBy: pkg?.receivedBy,
        associatedShipments: pkg?.associatedShipments,
        carrierCode: pkg?.carrierCode,
        serviceDesc: pkg?.serviceDesc
      });
      console.log('Scan events:');
      for (const ev of (pkg?.scanEventList || []).slice(0, 10)) {
        console.log(` - ${ev.date} ${ev.time}: ${ev.status} (${ev.scanLocation})`);
      }
    } else {
      console.log('FedEx response not OK:', await res.text());
    }
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

run();
