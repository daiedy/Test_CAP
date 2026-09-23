import cds from '@sap/cds';

/**
 * Only job of this handler: tell the Fiori UI whether the caller may edit.
 * Enforcement is declarative (@requires / @restrict in catalog-service.cds); this is the
 * signal behind UI.CreateHidden / UI.UpdateHidden / UI.DeleteHidden (ADR-0013).
 */
export default class CatalogService extends cds.ApplicationService {
  init() {
    this.on('READ', 'Permissions', (req) =>
      req.reply({ ID: 'me', isEditor: req.user.is('CatalogEditor') })
    );
    return super.init();
  }
}
