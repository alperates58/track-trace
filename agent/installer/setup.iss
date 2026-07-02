[Setup]
AppName=TrackTrace Local Agent
AppVersion=1.0.0
DefaultDirName={autopf}\TrackTraceAgent
DefaultGroupName=TrackTrace Local Agent
OutputBaseFilename=TrackTraceLocalAgentSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Dirs]
Name: "{commonappdata}\TrackTraceAgent"
Name: "{commonappdata}\TrackTraceAgent\Logs"

[Files]
Source: "publish\TrackTrace.LocalAgent.dll"; DestDir: "{app}"; DestName: "TrackTrace.LocalAgent.dll"; Flags: ignoreversion; BeforeInstall: PreInstallCleanup
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs; Excludes: "TrackTrace.LocalAgent,TrackTrace.LocalAgent.dll"

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop TrackTraceAgent"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{sys}\sc.exe"; Parameters: "delete TrackTraceAgent"; Flags: runhidden waituntilterminated; RunOnceId: "DeleteService"

[Code]
var
  TokenEdit: TNewEdit;
  CopyButton: TNewButton;
  OpenTrackTraceButton: TNewButton;
  ServiceInstalled: Boolean;

function RunSc(Parameters: String; StepName: String; IgnoreErrors: Boolean): Boolean;
var
  ResultCode: Integer;
begin
  ResultCode := -1;
  Result := Exec(ExpandConstant('{sys}\sc.exe'), Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  if IgnoreErrors then
  begin
    Result := True;
    Exit;
  end;

  if (not Result) or (ResultCode <> 0) then
  begin
    MsgBox('HATA: ' + StepName + ' basarisiz oldu. sc.exe exit code: ' + IntToStr(ResultCode), mbError, MB_OK);
    Abort;
  end;
end;

procedure WaitForServiceDeleted();
var
  I, ResultCode: Integer;
begin
  for I := 1 to 60 do
  begin
    ResultCode := -1;
    Exec(ExpandConstant('{sys}\sc.exe'), 'query TrackTraceAgent', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    if ResultCode <> 0 then
      Exit;
    Sleep(500);
  end;
end;

function MakePairingToken(): String;
var
  Hash: String;
begin
  Hash := GetSHA1OfString(
    GetDateTimeString('yyyymmddhhnnss', '-', ':') + '-' +
    IntToStr(Random(1000000000)) + '-' +
    IntToStr(Random(1000000000)) + '-' +
    ExpandConstant('{app}'));

  Result :=
    Copy(Hash, 1, 8) + '-' +
    Copy(Hash, 9, 4) + '-' +
    Copy(Hash, 13, 4) + '-' +
    Copy(Hash, 17, 4) + '-' +
    Copy(Hash, 21, 12);
end;

procedure EnsureAgentConfig();
var
  ConfigDir, LogsDir, ConfigPath, JsonContent: String;
begin
  ConfigDir := ExpandConstant('{commonappdata}\TrackTraceAgent');
  LogsDir := ExpandConstant('{commonappdata}\TrackTraceAgent\Logs');
  ConfigPath := ExpandConstant('{commonappdata}\TrackTraceAgent\agent.config.json');

  if FileExists(ConfigPath) then
    Exit;

  if not DirExists(ConfigDir) then
    CreateDir(ConfigDir);

  if not DirExists(LogsDir) then
    CreateDir(LogsDir);

  JsonContent :=
    '{' + #13#10 +
    '  "PairingToken": "' + MakePairingToken() + '",' + #13#10 +
    '  "DefaultPrinter": "ARGOX CP-2140",' + #13#10 +
    '  "EnableDummyMode": false' + #13#10 +
    '}';

  if (not SaveStringToFile(ConfigPath, JsonContent, False)) or (not FileExists(ConfigPath)) then
  begin
    MsgBox('HATA: agent.config.json olusturulamadi: ' + ConfigPath, mbError, MB_OK);
    Abort;
  end;
end;

procedure InstallService();
var
  DotnetPath, AgentDllPath: String;
begin
  if ServiceInstalled then
    Exit;

  DotnetPath := 'C:\Program Files\dotnet\dotnet.exe';
  AgentDllPath := ExpandConstant('{app}\TrackTrace.LocalAgent.dll');

  if not FileExists(DotnetPath) then
  begin
    MsgBox('.NET runtime bulunamadi. Lutfen Microsoft .NET Runtime yukleyin ve kurulumu tekrar calistirin: ' + DotnetPath, mbError, MB_OK);
    Abort;
  end;

  if not FileExists(AgentDllPath) then
  begin
    MsgBox('HATA: TrackTrace.LocalAgent.dll dosyasi bulunamadi: ' + AgentDllPath, mbError, MB_OK);
    Abort;
  end;

  RunSc(
    'create TrackTraceAgent binPath= "\"' + DotnetPath + '\" \"' + AgentDllPath + '\"" DisplayName= "TrackTrace Local Agent" start= auto',
    'TrackTraceAgent service create',
    False);

  RunSc(
    'config TrackTraceAgent binPath= "\"' + DotnetPath + '\" \"' + AgentDllPath + '\"" start= auto',
    'TrackTraceAgent service startup config',
    False);

  RunSc('start TrackTraceAgent', 'TrackTraceAgent service start', False);

  ServiceInstalled := True;
end;

procedure PreInstallCleanup();
begin
  RunSc('stop TrackTraceAgent', 'Stopping existing TrackTraceAgent service', True);
  RunSc('delete TrackTraceAgent', 'Deleting existing TrackTraceAgent service', True);
  WaitForServiceDeleted();
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not FileExists(ExpandConstant('{app}\TrackTrace.LocalAgent.dll')) then
    begin
      MsgBox('HATA: TrackTrace.LocalAgent.dll dosyasi kurulum klasorune kopyalanamadi!', mbError, MB_OK);
      Abort;
    end;

    EnsureAgentConfig();
    InstallService();
  end;
end;

function GetPairingToken(): String;
var
  ConfigPath: String;
  JsonContent: AnsiString;
  P1, P2: Integer;
  Token: String;
  I: Integer;
begin
  Token := '';
  ConfigPath := ExpandConstant('{commonappdata}\TrackTraceAgent\agent.config.json');

  for I := 1 to 60 do
  begin
    if FileExists(ConfigPath) then
      break;
    Sleep(500);
  end;

  if LoadStringFromFile(ConfigPath, JsonContent) then
  begin
    P1 := Pos('"PairingToken"', JsonContent);
    if P1 > 0 then
    begin
      JsonContent := Copy(JsonContent, P1 + 14, Length(JsonContent));
      P1 := Pos('"', JsonContent);
      if P1 > 0 then
      begin
        JsonContent := Copy(JsonContent, P1 + 1, Length(JsonContent));
        P2 := Pos('"', JsonContent);
        if P2 > 0 then
          Token := Copy(JsonContent, 1, P2 - 1);
      end;
    end;
  end;

  Result := Token;
end;

procedure CopyButtonClick(Sender: TObject);
begin
  TokenEdit.SelStart := 0;
  TokenEdit.SelLength := Length(TokenEdit.Text);
  MsgBox('Token secildi. Ctrl+C ile kopyalayabilirsiniz.', mbInformation, MB_OK);
end;

procedure OpenTrackTraceClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', 'https://track.alperates.com.tr', '', '', SW_SHOW, ewNoWait, ErrorCode);
end;

procedure CurPageChanged(CurPageID: Integer);
var
  TokenValue: String;
  DllPath: String;
begin
  if CurPageID = wpFinished then
  begin
    DllPath := ExpandConstant('{app}\TrackTrace.LocalAgent.dll');
    if not FileExists(DllPath) then
    begin
      WizardForm.FinishedLabel.Caption := 'Kurulum basarisiz oldu: TrackTrace.LocalAgent.dll dosyasi bulunamadi!';
      Exit;
    end;

    WizardForm.FinishedLabel.Caption := 'TrackTrace Local Agent basariyla kuruldu.' + #13#10 + #13#10 + 'Lutfen asagidaki Pairing Token degerini kopyalayin ve TrackTrace uygulamasindaki Local Agent ayarlarina yapistirin. Bu islem yalnizca bir kez yapilacaktir.';
    WizardForm.FinishedLabel.Top := 72;
    WizardForm.FinishedLabel.Height := 100;

    TokenValue := GetPairingToken();
    if TokenValue = '' then
      TokenValue := 'Token okunamadi.';

    TokenEdit := TNewEdit.Create(WizardForm);
    TokenEdit.Parent := WizardForm.FinishedPage;
    TokenEdit.Top := 190;
    TokenEdit.Left := WizardForm.FinishedLabel.Left;
    TokenEdit.Width := 300;
    TokenEdit.Text := TokenValue;
    TokenEdit.ReadOnly := True;
    TokenEdit.Font.Style := [fsBold];

    CopyButton := TNewButton.Create(WizardForm);
    CopyButton.Parent := WizardForm.FinishedPage;
    CopyButton.Top := TokenEdit.Top - 1;
    CopyButton.Left := TokenEdit.Left + TokenEdit.Width + 10;
    CopyButton.Width := 90;
    CopyButton.Caption := 'Sec';
    CopyButton.OnClick := @CopyButtonClick;

    OpenTrackTraceButton := TNewButton.Create(WizardForm);
    OpenTrackTraceButton.Parent := WizardForm.FinishedPage;
    OpenTrackTraceButton.Top := TokenEdit.Top + TokenEdit.Height + 20;
    OpenTrackTraceButton.Left := TokenEdit.Left;
    OpenTrackTraceButton.Width := 150;
    OpenTrackTraceButton.Caption := 'TrackTrace''i Ac';
    OpenTrackTraceButton.OnClick := @OpenTrackTraceClick;
  end;
end;
