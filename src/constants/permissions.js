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
    delete: false,
    contabilizar: false,
    export: true,
    ajustes: false,
    usuarios: false,
  },
  contable: {
    upload: true,
    edit: true,
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
  const r = user?.rol || "usuario";
  return (PERMISSIONS[r] || PERMISSIONS.usuario)[permission] || false;
}
