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
Source: "publish\TrackTrace.LocalAgent.exe"; DestDir: "{app}"; Flags: ignoreversion; BeforeInstall: PreInstallCleanup
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs; Excludes: "TrackTrace.LocalAgent.exe"

[Run]
Filename: "{sys}\sc.exe"; Parameters: "create TrackTraceAgent binPath= ""{app}\TrackTrace.LocalAgent.exe"" DisplayName= ""TrackTrace Local Agent"" start= auto"; Flags: runhidden waituntilterminated; StatusMsg: "Creating service..."
Filename: "{sys}\sc.exe"; Parameters: "config TrackTraceAgent start= auto"; Flags: runhidden waituntilterminated; StatusMsg: "Configuring service startup..."
Filename: "{sys}\sc.exe"; Parameters: "start TrackTraceAgent"; Flags: runhidden waituntilterminated; StatusMsg: "Starting service..."

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop TrackTraceAgent"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{sys}\sc.exe"; Parameters: "delete TrackTraceAgent"; Flags: runhidden waituntilterminated; RunOnceId: "DeleteService"

[Code]
var
  TokenEdit: TNewEdit;
  CopyButton: TNewButton;
  OpenTrackTraceButton: TNewButton;

procedure PreInstallCleanup();
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop TrackTraceAgent', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete TrackTraceAgent', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not FileExists(ExpandConstant('{app}\TrackTrace.LocalAgent.exe')) then
    begin
      MsgBox('HATA: TrackTrace.LocalAgent.exe dosyası kurulum klasörüne kopyalanamadı! Antivirüs yazılımınız engelliyor olabilir veya dosya açık kalmış olabilir.', mbError, MB_OK);
      Abort;
    end;
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
  
  for I := 1 to 20 do
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
        begin
          Token := Copy(JsonContent, 1, P2 - 1);
        end;
      end;
    end;
  end;
  
  Result := Token;
end;

procedure CopyButtonClick(Sender: TObject);
var
  ResultCode: Integer;
begin
  Exec('powershell.exe', '-command "Set-Clipboard -Value ''' + TokenEdit.Text + '''"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  MsgBox('Token kopyalandı! TrackTrace ayarlar sayfasına yapıştırabilirsiniz.', mbInformation, MB_OK);
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
  ExePath: String;
begin
  if CurPageID = wpFinished then
  begin
    ExePath := ExpandConstant('{app}\TrackTrace.LocalAgent.exe');
    if not FileExists(ExePath) then
    begin
      WizardForm.FinishedLabel.Caption := 'Kurulum başarısız oldu: TrackTrace.LocalAgent.exe dosyası bulunamadı!';
      Exit;
    end;
    
    WizardForm.FinishedLabel.Caption := 'TrackTrace Local Agent başarıyla kuruldu.' + #13#10 + #13#10 + 'Lütfen aşağıdaki Pairing Token değerini kopyalayın ve TrackTrace uygulamasındaki Local Agent ayarlarına yapıştırın. Bu işlem yalnızca bir kez yapılacaktır.';
    
    TokenValue := GetPairingToken();
    if TokenValue = '' then
      TokenValue := 'Token okunamadı. Servis başlamamış olabilir.';
      
    TokenEdit := TNewEdit.Create(WizardForm);
    TokenEdit.Parent := WizardForm.FinishedPage;
    TokenEdit.Top := WizardForm.FinishedLabel.Top + WizardForm.FinishedLabel.Height + 20;
    TokenEdit.Left := WizardForm.FinishedLabel.Left;
    TokenEdit.Width := 250;
    TokenEdit.Text := TokenValue;
    TokenEdit.ReadOnly := True;
    TokenEdit.Font.Style := [fsBold];
    
    CopyButton := TNewButton.Create(WizardForm);
    CopyButton.Parent := WizardForm.FinishedPage;
    CopyButton.Top := TokenEdit.Top - 1;
    CopyButton.Left := TokenEdit.Left + TokenEdit.Width + 10;
    CopyButton.Width := 80;
    CopyButton.Caption := 'Kopyala';
    CopyButton.OnClick := @CopyButtonClick;
    
    OpenTrackTraceButton := TNewButton.Create(WizardForm);
    OpenTrackTraceButton.Parent := WizardForm.FinishedPage;
    OpenTrackTraceButton.Top := TokenEdit.Top + TokenEdit.Height + 20;
    OpenTrackTraceButton.Left := TokenEdit.Left;
    OpenTrackTraceButton.Width := 150;
    OpenTrackTraceButton.Caption := 'TrackTrace''i Aç';
    OpenTrackTraceButton.OnClick := @OpenTrackTraceClick;
  end;
end;
