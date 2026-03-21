/**
 * SQLite-backed student profile storage.
 *
 * Responsibilities:
 * - CRUD operations for student profiles.
 * - Bulk import with transaction.
 * - Migration helper for state.json → SQLite transition.
 */

const Database = require("better-sqlite3");
const { createLogger } = require("../../../shared/utils/logger");

const logger = createLogger("ids-student-db");

/**
 * Creates a student profile database backed by SQLite.
 *
 * @param {string} dbPath - Path to the SQLite database file.
 * @returns {object} Student DB API.
 */
function createStudentDb(dbPath) {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      nfc_uid             TEXT PRIMARY KEY,
      display_name        TEXT NOT NULL,
      timetable_image_url TEXT NOT NULL DEFAULT '',
      next_class_text     TEXT NOT NULL DEFAULT '',
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const stmts = {
    upsert: db.prepare(`
      INSERT OR REPLACE INTO student_profiles
        (nfc_uid, display_name, timetable_image_url, next_class_text, updated_at)
      VALUES
        (@nfcUid, @displayName, @timetableImageUrl, @nextClassText, @updatedAt)
    `),
    getByUid: db.prepare(
      "SELECT * FROM student_profiles WHERE nfc_uid = ?",
    ),
    listAll: db.prepare(
      "SELECT * FROM student_profiles ORDER BY display_name",
    ),
    deleteByUid: db.prepare(
      "DELETE FROM student_profiles WHERE nfc_uid = ?",
    ),
    deleteAll: db.prepare(
      "DELETE FROM student_profiles",
    ),
    count: db.prepare(
      "SELECT COUNT(*) as count FROM student_profiles",
    ),
  };

  /**
   * Maps a SQLite row to a profile object.
   *
   * @param {object|undefined} row - Database row.
   * @returns {object|null} Profile object or null.
   */
  function toProfile(row) {
    if (!row) return null;
    return {
      nfcUid: row.nfc_uid,
      displayName: row.display_name,
      timetableImageUrl: row.timetable_image_url,
      nextClassText: row.next_class_text,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Inserts or replaces a single student profile.
   *
   * @param {object} profile - Normalized student profile.
   */
  function upsertProfile(profile) {
    stmts.upsert.run({
      nfcUid: profile.nfcUid,
      displayName: profile.displayName,
      timetableImageUrl: profile.timetableImageUrl || "",
      nextClassText: profile.nextClassText || "",
      updatedAt: profile.updatedAt || new Date().toISOString(),
    });
  }

  /**
   * Returns a single profile by NFC UID.
   *
   * @param {string} nfcUid - Student NFC UID.
   * @returns {object|null} Profile or null.
   */
  function getByUid(nfcUid) {
    return toProfile(stmts.getByUid.get(nfcUid));
  }

  /**
   * Returns all student profiles ordered by display name.
   *
   * @returns {Array<object>} All profiles.
   */
  function listAll() {
    return stmts.listAll.all().map(toProfile);
  }

  /**
   * Deletes a single profile by NFC UID.
   *
   * @param {string} nfcUid - Student NFC UID.
   * @returns {boolean} True if a row was deleted.
   */
  function deleteByUid(nfcUid) {
    return stmts.deleteByUid.run(nfcUid).changes > 0;
  }

  /**
   * Replaces all profiles in a single transaction.
   *
   * @param {Array<object>} profiles - Normalized profile list.
   */
  function importProfiles(profiles) {
    const runImport = db.transaction((items) => {
      stmts.deleteAll.run();
      for (const profile of items) {
        upsertProfile(profile);
      }
    });
    runImport(profiles);
  }

  /**
   * Returns total number of stored profiles.
   *
   * @returns {number} Profile count.
   */
  function count() {
    return stmts.count.get().count;
  }

  /**
   * Closes the database connection.
   */
  function close() {
    db.close();
  }

  /**
   * Migrates profiles from state.json array into SQLite.
   * Only runs if the DB is empty and profiles exist.
   *
   * @param {Array<object>} profiles - Profiles from state.json.
   */
  function migrateFromState(profiles) {
    if (!Array.isArray(profiles) || profiles.length === 0) return;
    if (count() > 0) return;

    logger.info("migrating_student_profiles", { count: profiles.length });
    importProfiles(profiles);
    logger.info("migration_complete", { count: profiles.length });
  }

  return {
    upsertProfile,
    getByUid,
    listAll,
    deleteByUid,
    importProfiles,
    count,
    close,
    migrateFromState,
  };
}

module.exports = { createStudentDb };
