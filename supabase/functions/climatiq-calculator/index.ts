// =================================================================================
// --- Supabase Edge Function: climatiq-calculator (v6.0 - FINAL & CORS FIXED) ---
// =================================================================================
import { serve } from 'https://deno.land/std/http/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIMATIQ_SELECTORS = {
  electricity: { activity_id: 'electricity-supply_grid-source_supplier_mix' },
  heating: { activity_id: 'heat-and-steam-supply_district-heating-source_supplier_mix' },
  cooling: { activity_id: 'heat-and-steam-supply_district-heating-source_supplier-mix' },
  steam: { activity_id: 'heat-and-steam-supply_district-heating-source_supplier-mix' },
  stationary_combustion: { 'Natural Gas': { activity_id: 'fuel-type_natural_gas-fuel_use_stationary_combustion' }, 'Diesel': { activity_id: 'fuel-type_diesel-fuel_use_stationary_combustion' }, 'Propane': { activity_id: 'fuel-type_propane-fuel_use_stationary_combustion' }, 'Fuel Oil': { activity_id: 'fuel-type_fuel_oil_no_2-fuel_use_stationary_combustion' }, 'Coal': { activity_id: 'fuel-type_coal_anthracite-fuel_use_stationary_combustion' }, },
  mobile_combustion: { 'Passenger Car': { activity_id: 'passenger_vehicle-vehicle_type_car-fuel_source_na-engine_size_na' }, 'Light-Duty Truck': { activity_id: 'passenger_vehicle-vehicle_type_light_duty_truck-fuel_source_na-engine_size_na' }, 'Heavy-Duty Truck': { activity_id: 'commercial_vehicle-vehicle_type_truck_heavy_duty-fuel_source_diesel' }, 'Bus': { activity_id: 'passenger_vehicle-vehicle_type_bus-fuel_source_na-engine_size_na' }, 'Motorcycle': { activity_id: 'passenger_vehicle-vehicle_type_motorcycle-fuel_source_na-engine_size_na' } },
  fugitive_emissions: { 'R-134a': { activity_id: 'refrigerant-type_r134a-refrigerant_charge_method_per_unit' }, 'R-410A': { activity_id: 'refrigerant-type_r410a-refrigerant_charge_method_per_unit' }, 'R-404A': { activity_id: 'refrigerant-type_r404a-refrigerant_charge_method_per_unit' }, 'R-22': { activity_id: 'refrigerant-type_r22-refrigerant_charge_method_per_unit' }, 'Other': { activity_id: 'refrigerant-type_hfc_blend-refrigerant_charge_method_per_unit' }, },
  process_emissions: { 'Cement Production': { activity_id: 'industrial_process-process_type_cement_production' }, 'Ammonia Production': { activity_id: 'industrial_process-process_type_ammonia_production' }, 'Aluminum Production': { activity_id: 'industrial_process-process_type_aluminum_production' }, }
};
const UNIT_MAP = {'kwh': 'kWh','mwh': 'MWh','gwh': 'GWh','mmbtu': 'MMBtu','gj': 'GJ','btu': 'BTU','tonnes of refrigeration': 'ton_hour_refrigeration','therms': 'therms_us','cubic meters (m³)': 'm3','litres': 'l','gallons (us)': 'gallon_us','lbs (pounds)': 'lbs','kg (kilograms)': 'kg','tonnes': 't','short tons (us)': 'ton_us','kilometers': 'km','miles': 'mi',};
const mapRegion = (longRegion) => { const regionMap = { 'Europe': 'EU', 'North America': 'US', 'Asia-Pacific': 'CN', 'South America': 'BR' }; return regionMap[longRegion] || 'GB'; };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { category, form_data } = await req.json();
    const climatiqApiKey = Deno.env.get('CLIMATIQ_API_KEY');
    if (!climatiqApiKey) throw new Error('API key not configured.');
    let emission_factor = {}; let parameters = {};
    switch (category) {
      case 'electricity': case 'heating': case 'cooling': case 'steam': emission_factor = { ...CLIMATIQ_SELECTORS[category], region: mapRegion(form_data.region), year: 2023, source: 'BEIS' }; parameters = { energy: parseFloat(form_data.quantity), energy_unit: UNIT_MAP[form_data.unit.toLowerCase()] }; break;
      case 'stationary_combustion': emission_factor = { ...CLIMATIQ_SELECTORS[category][form_data.fuelType], region: mapRegion(form_data.facility), year: 2023, source: 'BEIS' }; const unit_type = ['Litres', 'Gallons (US)', 'Cubic Meters (m³)', 'Therms'].includes(form_data.unit) ? 'volume' : 'mass'; parameters[unit_type] = parseFloat(form_data.consumed); parameters[`${unit_type}_unit`] = UNIT_MAP[form_data.unit.toLowerCase()]; break;
      case 'mobile_combustion': emission_factor = { ...CLIMATIQ_SELECTORS[category][form_data.vehicle], region: mapRegion(form_data.facility), year: 2023, source: 'BEIS' }; if (form_data.method === 'fuel') { parameters = { fuel: parseFloat(form_data.fuelConsumed), fuel_unit: UNIT_MAP[form_data.fuelUnit.toLowerCase()] }; } else { parameters = { distance: parseFloat(form_data.distance), distance_unit: UNIT_MAP[form_data.distanceUnit.toLowerCase()] }; } break;
      case 'fugitive_emissions': emission_factor = CLIMATIQ_SELECTORS[category][form_data.refrigerant]; const gasAmount = form_data.method === 'refilled' ? form_data.gasRefilled : (parseFloat(form_data.chargeCapacity) * parseFloat(form_data.leakRate)) / 100; parameters = { mass: gasAmount, mass_unit: 'kg' }; break;
      case 'process_emissions': emission_factor = CLIMATIQ_SELECTORS[category][form_data.process]; parameters = { mass: parseFloat(form_data.throughput), mass_unit: 't' }; break;
      default: throw new Error(`Invalid category: ${category}`);
    }
    const response = await fetch('https://api.climatiq.io/v1/estimate', { method: 'POST', headers: { 'Authorization': `Bearer ${climatiqApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ emission_factor, parameters }) });
    if (!response.ok) { const errorBody = await response.json(); throw new Error(`[Climatiq API Error] ${errorBody.error_message}`); }
    const result = await response.json();
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  } catch (error) {
    console.error("Edge Function Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});