import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Disposable, StatusBarAlignment, StatusBarItem, Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService, IDisposableRegistry, IPathUtils, IPythonSettings } from '../../client/common/types';
import { IInterpreterDisplay, IInterpreterHelper, IInterpreterService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Architecture } from '../../utils/platform';

// tslint:disable:no-any max-func-body-length

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};

suite('Interpreters Display', () => {
    let applicationShell: TypeMoq.IMock<IApplicationShell>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let virtualEnvMgr: TypeMoq.IMock<IVirtualEnvironmentManager>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let disposableRegistry: Disposable[];
    let statusBar: TypeMoq.IMock<StatusBarItem>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let interpreterDisplay: IInterpreterDisplay;
    let interpreterHelper: TypeMoq.IMock<IInterpreterHelper>;
    let pathUtils: TypeMoq.IMock<IPathUtils>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        applicationShell = TypeMoq.Mock.ofType<IApplicationShell>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        virtualEnvMgr = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        interpreterHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        disposableRegistry = [];
        statusBar = TypeMoq.Mock.ofType<StatusBarItem>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pathUtils = TypeMoq.Mock.ofType<IPathUtils>();

        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => applicationShell.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterService))).returns(() => interpreterService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IVirtualEnvironmentManager))).returns(() => virtualEnvMgr.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => disposableRegistry);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configurationService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterHelper))).returns(() => interpreterHelper.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPathUtils))).returns(() => pathUtils.object);

        applicationShell.setup(a => a.createStatusBarItem(TypeMoq.It.isValue(StatusBarAlignment.Left), TypeMoq.It.isValue(undefined))).returns(() => statusBar.object);
        pathUtils.setup(p => p.getDisplayName(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(p => p);

        interpreterDisplay = new InterpreterDisplay(serviceContainer.object);
    });
    function setupWorkspaceFolder(resource: Uri, workspaceFolder?: Uri) {
        if (workspaceFolder) {
            const mockFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            mockFolder.setup(w => w.uri).returns(() => workspaceFolder);
            workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource))).returns(() => mockFolder.object);
        } else {
            workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource))).returns(() => undefined);
        }
    }
    test('Sattusbar must be created and have command name initialized', () => {
        statusBar.verify(s => s.command = TypeMoq.It.isValue('python.setInterpreter'), TypeMoq.Times.once());
        expect(disposableRegistry).to.be.lengthOf.above(0);
        expect(disposableRegistry).contain(statusBar.object);
    });
    test('Display name and tooltip must come from interpreter info', async () => {
        const resource = Uri.file('x');
        const workspaceFolder = Uri.file('workspace');
        const activeInterpreter: PythonInterpreter = {
            ...info,
            displayName: 'Dummy_Display_Name',
            type: InterpreterType.Unknown,
            path: path.join('user', 'development', 'env', 'bin', 'python')
        };
        setupWorkspaceFolder(resource, workspaceFolder);
        interpreterService.setup(i => i.getInterpreters(TypeMoq.It.isValue(workspaceFolder))).returns(() => Promise.resolve([]));
        interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder))).returns(() => Promise.resolve(activeInterpreter));

        await interpreterDisplay.refresh(resource);

        statusBar.verify(s => s.text = TypeMoq.It.isValue(activeInterpreter.displayName)!, TypeMoq.Times.once());
        statusBar.verify(s => s.tooltip = TypeMoq.It.isValue(activeInterpreter.path)!, TypeMoq.Times.once());
    });
    test('If interpreter is not identified then tooltip should point to python Path', async () => {
        const resource = Uri.file('x');
        const pythonPath = path.join('user', 'development', 'env', 'bin', 'python');
        const workspaceFolder = Uri.file('workspace');
        const displayName = 'This is the display name';

        setupWorkspaceFolder(resource, workspaceFolder);
        const pythonInterpreter: PythonInterpreter = {
            displayName,
            path: pythonPath
        } as any as PythonInterpreter;
        interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder))).returns(() => Promise.resolve(pythonInterpreter));

        await interpreterDisplay.refresh(resource);

        statusBar.verify(s => s.tooltip = TypeMoq.It.isValue(pythonPath), TypeMoq.Times.once());
        statusBar.verify(s => s.text = TypeMoq.It.isValue(displayName), TypeMoq.Times.once());
    });
    test('If interpreter file does not exist then update status bar accordingly', async () => {
        const resource = Uri.file('x');
        const pythonPath = path.join('user', 'development', 'env', 'bin', 'python');
        const workspaceFolder = Uri.file('workspace');
        setupWorkspaceFolder(resource, workspaceFolder);
        // tslint:disable-next-line:no-any
        interpreterService.setup(i => i.getInterpreters(TypeMoq.It.isValue(workspaceFolder))).returns(() => Promise.resolve([{} as any]));
        interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder))).returns(() => Promise.resolve(undefined));
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
        fileSystem.setup(f => f.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));
        interpreterHelper.setup(v => v.getInterpreterInformation(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(undefined));
        virtualEnvMgr.setup(v => v.getEnvironmentName(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(''));

        await interpreterDisplay.refresh(resource);

        statusBar.verify(s => s.color = TypeMoq.It.isValue('yellow'), TypeMoq.Times.once());
        statusBar.verify(s => s.text = TypeMoq.It.isValue('$(alert) Select Python Environment'), TypeMoq.Times.once());
    });
    test('Ensure we try to identify the active workspace when a resource is not provided ', async () => {
        const workspaceFolder = Uri.file('x');
        const resource = workspaceFolder;
        const pythonPath = path.join('user', 'development', 'env', 'bin', 'python');
        const activeInterpreter: PythonInterpreter = {
            ...info,
            displayName: 'Dummy_Display_Name',
            type: InterpreterType.Unknown,
            companyDisplayName: 'Company Name',
            path: pythonPath
        };
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
        virtualEnvMgr.setup(v => v.getEnvironmentName(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(''));
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isValue(resource)))
            .returns(() => Promise.resolve(activeInterpreter))
            .verifiable(TypeMoq.Times.once());
        interpreterHelper
            .setup(i => i.getActiveWorkspaceUri())
            .returns(() => { return { folderUri: workspaceFolder, configTarget: ConfigurationTarget.Workspace }; })
            .verifiable(TypeMoq.Times.once());

        await interpreterDisplay.refresh();

        interpreterHelper.verifyAll();
        interpreterService.verifyAll();
        statusBar.verify(s => s.text = TypeMoq.It.isValue(activeInterpreter.displayName)!, TypeMoq.Times.once());
        statusBar.verify(s => s.tooltip = TypeMoq.It.isValue(pythonPath)!, TypeMoq.Times.once());
    });
});
