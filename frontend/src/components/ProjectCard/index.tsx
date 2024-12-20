import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Shuffle, Settings, Folder, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogFooter,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTrigger,
  DialogPortal,
  DialogTitle,
} from "../ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { SubmitHandler, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Select } from "../ui/select";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { ISettings } from "../SettingDIalog";
import { useToast } from "@/hooks/use-toast";

export interface IProject {
  name: string;
  description: string;
  version: string;
  path: string;
  icon: string;
  iconPath: string;
}

export interface ProjectCardProps extends IProject {
  key: number;
  settings: ISettings | undefined;
}

export interface IExportSettings {
  exportPath: string;
  projectType: string;
  deviceOrientation: string;
  appid: string;
}

const ProjectSettingDialog = (props: {
  projectPath: string;
  exportSettings: IExportSettings | undefined;
  setExport: (exportSettings: IExportSettings) => void;
}) => {
  const form = useForm<IExportSettings>({});
  const { setValue } = form;
  const [open, setOpen] = useState(false);
  if (props.exportSettings) {
    setValue("deviceOrientation", props.exportSettings.deviceOrientation);
    setValue("exportPath", props.exportSettings.exportPath);
    setValue("projectType", props.exportSettings.projectType);
    setValue("appid", props.exportSettings.appid);
  } else {
    setValue("exportPath", "./minigame");
  }
  const onSubmit: SubmitHandler<IExportSettings> = (data) => {
    window.pywebview.api
      .save_export_settings(props.projectPath, data)
      .then(() => {
        setOpen(false);
        props.setExport(data);
      });
  };
  const getExportPath = () => {
    window.pywebview.api.open_export_path(props.projectPath).then((value) => {
      setValue("exportPath", String(value));
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="icon">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>导出设置</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="deviceOrientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>屏幕方向</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择游戏是横屏还是竖屏"></SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectContent>
                          <SelectItem value="portrait">竖向</SelectItem>
                          <SelectItem value="landscape">横向</SelectItem>
                        </SelectContent>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              ></FormField>
              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>项目类型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择项目类型，2D还是全部，2d会比体积小一点"></SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectContent>
                          <SelectItem value="2d">2D</SelectItem>
                          <SelectItem value="full">全部</SelectItem>
                        </SelectContent>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              ></FormField>
              <FormField
                control={form.control}
                name="appid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>APPID</FormLabel>
                    <FormControl>
                      <div className="flex w-full items-center space-x-1">
                        <Input placeholder="小游戏的APPID" {...field}></Input>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              ></FormField>
              <FormField
                control={form.control}
                name="exportPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>输出目录</FormLabel>
                    <FormControl>
                      <div className="flex w-full items-center space-x-1">
                        <Input
                          placeholder="小游戏工程输出目录"
                          {...field}
                        ></Input>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(event) => {
                            getExportPath();
                            event.preventDefault();
                          }}
                        >
                          <Folder />
                        </Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              ></FormField>
              <Separator />
              <div className="w-full mt-6"></div>
              <DialogFooter>
                <Button type="submit">保存</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

const ProjectCard = (props: ProjectCardProps) => {
  const { toast } = useToast();
  const [exportSettings, setExportSettings] = useState<IExportSettings>();
  const [loading, setLoading] = useState(false);
  const exportGame = () => {
    if (!props.settings?.godotExecute) {
      toast({
        variant: "destructive",
        title: "导出失败",
        description: "未设置Godot引擎启动路径, 去设置里设置",
      });
      return;
    }
    if (!exportSettings?.exportPath) {
      console.log(exportSettings?.exportPath);
      toast({
        variant: "destructive",
        title: "导出失败",
        description: "未设置项目导出目录，去设置！",
      });
      return;
    }
    if (exportSettings) {
      setLoading(true);
      window.pywebview.api
        .export_game(
          props.path,
          exportSettings.exportPath,
          { name: props.name, description: props.description },
          exportSettings.appid
        )
        .then(() => {
          setLoading(false);
          toast({
            variant: "default",
            title: "导出成功",
            description: "导出成功了，用开发者工具导入吧！",
          });
        });
    }
  };

  useEffect(() => {
    const getExportSettings = () => {
      console.log(1);
      window.pywebview.api.get_export_settings(props.path).then((value) => {
        // @ts-expect-error this is python value
        setExportSettings(value);
      });
    };
    if (window.pywebview) {
      getExportSettings();
    } else {
      window.addEventListener("pywebviewready", getExportSettings);
    }
    return () => {
      window.removeEventListener("pywebviewready", getExportSettings);
    };
  }, [props.path]);

  return (
    <Card key={props.key}>
      <CardHeader className="flex items-center space-x-3">
        {(() => {
          if (props.icon.indexOf(".svg") !== -1) {
            return (
              <img
                src={`data:image/svg+xml;base64,${props.iconPath}`}
                width={64}
                height={64}
              ></img>
            );
          } else {
            return (
              <img
                src={`data:image/jpeg;base64,${props.iconPath}`}
                width={64}
                height={64}
              ></img>
            );
          }
          return "";
        })()}
        <CardTitle>{props.name}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
        <CardDescription>Version:{props.version}</CardDescription>
        <CardContent className="mt-4">
          <div className="flex justify-between space-x-1">
            {loading ? (
              <Button variant="outline" size="icon" disabled>
                <Loader2 className="animate-spin" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={(event) => {
                  exportGame();
                  event.preventDefault();
                }}
              >
                <Shuffle />
              </Button>
            )}

            <ProjectSettingDialog
              exportSettings={exportSettings}
              projectPath={props.path}
              setExport={(exportSettings) => {
                setExportSettings(exportSettings);
              }}
            ></ProjectSettingDialog>
          </div>
        </CardContent>
      </CardHeader>
    </Card>
  );
};

export default ProjectCard;
