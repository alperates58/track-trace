CREATE TABLE IF NOT EXISTS UserPermissions (
    UserId UUID REFERENCES Users(Id) ON DELETE CASCADE,
    PermissionKey VARCHAR(50) REFERENCES Permissions(Key) ON DELETE CASCADE,
    IsGranted BOOLEAN NOT NULL,
    PRIMARY KEY (UserId, PermissionKey)
);
