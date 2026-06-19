export const PERMISSIONS = {
  admin: {
    upload: true,
    edit: true,
    delete: true,
    contabilizar: true,
    export: true,
    ajustes: true,
    usuarios: true,
  },
  editor: {
    upload: true,
    edit: true,
    delete: true,
    contabilizar: false,
    export: true,
    ajustes: false,
    usuarios: false,
  },
  contable: {
    upload: false,
    edit: false,
    delete: false,
    contabilizar: true,
    export: true,
    ajustes: false,
    usuarios: false,
  },
  usuario: {
    upload: false,
    edit: false,
    delete: false,
    contabilizar: false,
    export: false,
    ajustes: false,
    usuarios: false,
  },
};

export function can(user, permission) {
  if (!user?.role) return false;
  const role = PERMISSIONS[user.role];
  return role ? !!role[permission] : false;
}
