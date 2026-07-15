// Fixed permission catalog. Application code ONLY ever checks these keys,
// never a role name. Roles are just named bundles an org Admin assembles
// from this list via the UI (see routes/roles.js).
export const PERMISSIONS = {
  LOAD_CREATE: 'load.create',
  LOAD_ASSIGN_CARRIER: 'load.assign_carrier',
  LOAD_OVERRIDE_COMPLIANCE_FLAG: 'load.override_compliance_flag',
  RATE_CONFIRM: 'rate.confirm',
  LOAD_UPDATE_STATUS: 'load.update_status',
  STAFF_MANAGE: 'staff.manage',
  POD_UPLOAD: 'pod.upload',
};

export const PERMISSION_CATALOG = [
  { key: PERMISSIONS.LOAD_CREATE, description: 'Create/post new loads', orgType: 'BROKER' },
  { key: PERMISSIONS.LOAD_ASSIGN_CARRIER, description: 'Assign a carrier to a load', orgType: 'BROKER' },
  { key: PERMISSIONS.LOAD_OVERRIDE_COMPLIANCE_FLAG, description: 'Override a compliance block', orgType: 'BROKER' },
  { key: PERMISSIONS.RATE_CONFIRM, description: 'Confirm/renegotiate rate confirmations', orgType: 'BROKER' },
  { key: PERMISSIONS.LOAD_UPDATE_STATUS, description: 'Update load shipment status', orgType: 'CARRIER' },
  { key: PERMISSIONS.STAFF_MANAGE, description: 'Create staff accounts and roles', orgType: 'BOTH' },
  { key: PERMISSIONS.POD_UPLOAD, description: 'Upload proof of delivery', orgType: 'CARRIER' },
];
