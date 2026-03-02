const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function loadStorageWithTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ids-admin-student-profiles-"));
  process.env.IDS_ADMIN_DATA_DIR = tempDir;

  const modulePath = path.resolve(__dirname, "../src/storage.js");
  delete require.cache[modulePath];
  const storage = require(modulePath);

  return { storage };
}

test("imports student profiles and generates campaign by UID", () => {
  const { storage } = loadStorageWithTempDir();

  const state = storage.importStudentProfiles({
    students: [
      {
        nfcUid: "uid-001",
        displayName: "Alice Doe",
        timetableImageUrl: "https://cdn.school.test/timetables/alice.png",
        nextClassText: "Next class: Math at 09:00",
      },
      {
        nfcUid: "uid-002",
        displayName: "Yassine Ben",
        timetableImageUrl: "https://cdn.school.test/timetables/yassine.png",
        nextClassText: "Next class: Physics at 10:15",
      },
      {
        nfcUid: "uid-003",
        displayName: "Sara Martin",
        timetableImageUrl: "/media/timetables/sara.png",
        nextClassText: "Next class: Chemistry at 11:30",
      },
      {
        nfcUid: "uid-004",
        displayName: "Lucas Ndiaye",
        timetableImageUrl: "https://cdn.school.test/timetables/lucas.png",
        nextClassText: "Next class: History at 13:00",
      },
    ],
  });

  assert.equal(state.studentProfiles.length, 4);
  assert.equal(state.studentProfiles[0].nfcUid, "uid-001");

  const expectedGenerated = [
    { uid: "uid-001", name: "Alice Doe", image: "https://cdn.school.test/timetables/alice.png" },
    { uid: "uid-002", name: "Yassine Ben", image: "https://cdn.school.test/timetables/yassine.png" },
    { uid: "uid-003", name: "Sara Martin", image: "/media/timetables/sara.png" },
    { uid: "uid-004", name: "Lucas Ndiaye", image: "https://cdn.school.test/timetables/lucas.png" },
  ];

  for (const expected of expectedGenerated) {
    const generated = storage.getGeneratedStudentCampaignByUid(expected.uid);
    assert.equal(generated.nfcUid, expected.uid);
    assert.equal(generated.name, expected.name);
    assert.equal(generated.campaign.kind, "student");
    assert.equal(generated.campaign.items[1].type, "IMAGE");
    assert.equal(generated.campaign.items[1].data, expected.image);
  }
});

test("rejects unsafe timetableImageUrl in student profile import", () => {
  const { storage } = loadStorageWithTempDir();

  assert.throws(
    () =>
      storage.importStudentProfiles({
        students: [
          {
            nfcUid: "uid-unsafe",
            displayName: "Unsafe URL",
            timetableImageUrl: "javascript:alert(1)",
          },
        ],
      }),
    (err) =>
      err.name === "ValidationError"
      && err.issues.some((i) => i.path === "students[0].timetableImageUrl" && i.code === "invalid_url"),
  );
});
