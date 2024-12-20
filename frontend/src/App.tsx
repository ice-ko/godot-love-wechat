import { useEffect, useState } from "react";
import logo from "./assets/logo.png";
import SettingsDialog, { ISettings } from "./components/SettingDIalog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import ProjectCard, { IProject } from "./components/ProjectCard";

function App() {
  const [settings, setSettings] = useState<ISettings>();
  const [projects, setProjects] = useState();
  const [filterProjects, setFilterProjects] = useState<IProject[]>([]);
  const [, setSearch] = useState<string>();
  useEffect(() => {
    const getSettings = () => {
      window.pywebview.api.get_settings().then((values) => {
        console.log(values);
        // @ts-expect-error this is a python value
        setSettings(values);
      });
    };
    if (window.pywebview) {
      getSettings();
    } else {
      window.addEventListener("pywebviewready", getSettings);
    }
    return () => {
      window.removeEventListener("pywebviewready", getSettings);
    };
  }, []);
  const getProjects = () => {
    window.pywebview.api.read_projects().then((projects) => {
      // @ts-expect-error this is a python value
      setProjects(projects);
      // @ts-expect-error this is a python value
      setFilterProjects(projects);
    });
  };
  useEffect(() => {
    if (window.pywebview) {
      getProjects();
    } else {
      window.addEventListener("pywebviewready", getProjects);
    }
    return () => {
      window.removeEventListener("pywebviewready", getProjects);
    };
  }, []);

  const openProject = () => {
    window.pywebview.api.open_projects().then(() => {
      getProjects();
    });
  };
  return (
    <div className="w-full h-full bg-blend-soft-light">
      <nav className="flex items-center justify-between bg-blend-soft-light p-4 shadow-md">
        <div className="logo">
          <img src={logo} alt="logo" className="h-12"></img>
        </div>
        <div className="text-center flex-grow">
          <span>项目</span>
        </div>
        <div className="settigns">
          <SettingsDialog
            setSettings={(values) => {
              setSettings(values);
            }}
          ></SettingsDialog>
        </div>
      </nav>
      <div className="m-4 flex items-center justify-between p-4 bg-blend-soft-light shadow-md space-x-1">
        <Button onClick={openProject}>导入</Button>
        <Input
          placeholder="搜索项目"
          onChange={(event) => {
            // @ts-expect-error this is a python value
            const fuzzySearch = (term: string, item) => {
              if (!term) return true;
              const lowerCaseTerm = term.toLowerCase();
              const lowerCaseItemName = item.name.toLowerCase();

              // 检查item.name是否包含term
              return lowerCaseItemName.includes(lowerCaseTerm);
            };
            setSearch(event.target.value);
            // @ts-expect-error this is a python value
            const result = projects.filter((item) =>
              fuzzySearch(event.target.value, item)
            );
            setFilterProjects(result);
          }}
        ></Input>
      </div>
      <div className="p-4 grid gap-4 grid-cols-3 ">
        {filterProjects
          ? filterProjects.map((project, index) => (
              <ProjectCard
                key={index}
                icon={project.icon}
                iconPath={project.iconPath}
                path={project.path}
                name={project.name}
                description={project.description}
                version={project.version}
                settings={settings}
              ></ProjectCard>
            ))
          : []}
      </div>
    </div>
  );
}

export default App;
